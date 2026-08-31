import { NextRequest, NextResponse } from "next/server";
import {
  ACCESS_TOKEN_COOKIE,
  AUTH_COOKIE_NAMES,
  REFRESH_TOKEN_COOKIE,
  authCookieDeleteTargets,
  buildAuthCookies,
  type TokenPair,
} from "@/lib/auth";

const API_URL = process.env.API_URL ?? "http://localhost:3001/v1";
const PROTECTED_PREFIX = "/dashboard";

/** `request.nextUrl.pathname` ist bereits ohne `basePath` (deshalb passen
 * Matcher und Präfix-Vergleiche unverändert), Redirect-/Rewrite-Ziele
 * brauchen ihn dagegen ausgeschrieben – Next.js ergänzt ihn hier nicht von
 * selbst. Siehe knowledge-base/platform/deployment.md. */
function internalUrl(request: NextRequest, path: string): URL {
  return new URL(`${request.nextUrl.basePath}${path}`, request.url);
}
// Einzige Seite, die PasswordChangeGuard/TwoFactorSetupGuard im Backend
// trotz aktivem `mustChangePassword`/`twoFactorSetupRequired` erreichbar
// lassen (siehe AllowPasswordChangeRequired()/AllowTwoFactorSetupRequired()
// auf den /auth/me-, /auth/password- und /auth/2fa/*-Routen) – jede andere
// Dashboard-Seite würde sonst nur leere "keine Berechtigung"-Zustände
// zeigen, ohne dass der Nutzer erfährt, warum (siehe AccountLockBanner).
const ACCOUNT_PATH = "/dashboard/account";

interface LockoutPayload {
  mustChangePassword?: boolean;
  twoFactorSetupRequired?: boolean;
}

// Nur zur UX-Weiterleitung, keine Signaturprüfung nötig: die eigentliche
// Durchsetzung passiert serverseitig per Guard, dieser Decode entscheidet
// lediglich, ob die Middleware vorsorglich zu /dashboard/account umleitet.
// `atob()` statt `Buffer.from()`: Middleware läuft standardmäßig im
// Edge-Runtime, der kein Node-`Buffer` kennt.
function decodeAccessToken(token: string): LockoutPayload | null {
  try {
    const segment = token.split(".")[1];
    const base64 = segment.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(
      base64.length + ((4 - (base64.length % 4)) % 4),
      "=",
    );
    return JSON.parse(atob(padded));
  } catch {
    return null;
  }
}

function applyLockoutRedirect(
  request: NextRequest,
  accessToken: string,
  response: NextResponse,
): NextResponse {
  if (request.nextUrl.pathname === ACCOUNT_PATH) {
    return response;
  }
  const payload = decodeAccessToken(accessToken);
  if (!payload) {
    return response;
  }
  const reason = payload.mustChangePassword
    ? "password"
    : payload.twoFactorSetupRequired
      ? "2fa"
      : null;
  if (!reason) {
    return response;
  }
  const url = internalUrl(request, ACCOUNT_PATH);
  url.searchParams.set("reason", reason);
  return NextResponse.redirect(url);
}

// `fetch()` hier läuft server-seitig (Next.js-Middleware) und schickt sonst
// Nodes eigenen User-Agent statt dem des echten Browsers – ohne explizite
// Weiterreichung zeigt "Aktive Sitzungen" (2b.14) für jede Sitzung nur
// "Unbekanntes Gerät" statt z.B. "Windows · Chrome".
async function tryRefresh(
  refreshToken: string,
  meta: { userAgent: string | null; forwardedFor: string | null },
): Promise<TokenPair | null> {
  try {
    const res = await fetch(`${API_URL}/auth/refresh`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(meta.userAgent && { "user-agent": meta.userAgent }),
        ...(meta.forwardedFor && { "x-forwarded-for": meta.forwardedFor }),
      },
      body: JSON.stringify({ refreshToken }),
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

function clearAuthCookies(response: NextResponse) {
  for (const name of AUTH_COOKIE_NAMES) {
    for (const target of authCookieDeleteTargets(name)) {
      response.cookies.delete(target);
    }
  }
  return response;
}

function applyAuthCookies(response: NextResponse, tokens: TokenPair) {
  for (const cookie of buildAuthCookies(tokens)) {
    response.cookies.set(cookie.name, cookie.value, cookie.options);
  }
  return response;
}

// Master/Slave-Lizenzsperre (siehe
// knowledge-base/platform/master-slave-licensing.md) – kurzlebiger
// In-Memory-Cache statt eines Aufrufs bei jedem einzelnen Request
// (Middleware läuft auf jeder passenden Anfrage). Auf einer Master-
// Installation liefert `/license/state` immer `{mode:"master"}`, der
// Cache bleibt dort dauerhaft `false`.
let lockedCache: { locked: boolean; checkedAt: number } | null = null;
const LOCKED_CACHE_TTL_MS = 30_000;

async function isInstanceLocked(): Promise<boolean> {
  // Nutzer-Bugreport, 2026-08-26: "nach korrektem Schlüssel eingeben und
  // prüfen, wird man auf locked weitergeleitet" – der TTL-Cache hielt eine
  // Sperre bis zu 30s lang fest, auch direkt nachdem sie gerade behoben
  // wurde. Nur das GÜNSTIGE Ergebnis (nicht gesperrt) wird noch
  // zwischengespeichert – das ist der Normalfall bei praktisch jeder
  // Anfrage und lohnt sich. Eine bestehende Sperre ist dagegen selten genug,
  // dass ein frischer Check bei jeder Anfrage keine spürbare Last
  // verursacht, ermöglicht dafür ein sofortiges Entsperren ohne Wartezeit.
  if (
    lockedCache &&
    !lockedCache.locked &&
    Date.now() - lockedCache.checkedAt < LOCKED_CACHE_TTL_MS
  ) {
    return false;
  }
  try {
    const res = await fetch(`${API_URL}/license/state`, { cache: "no-store" });
    if (!res.ok) return lockedCache?.locked ?? false;
    const data = await res.json();
    const locked = data?.mode === "slave" && data?.status === "locked";
    lockedCache = { locked, checkedAt: Date.now() };
    return locked;
  } catch {
    return lockedCache?.locked ?? false;
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Gesperrte Slave-Installation: Wartungsseite statt Dashboard/Login
  // (Nutzervorgabe: "Wartungsseite konfigurierbar") – URL bleibt für den
  // Besucher unverändert (rewrite statt redirect). Echter 503-Status statt
  // 200 – korrekt für Suchmaschinen/Monitoring ("vorübergehend nicht
  // verfügbar", nicht indexieren), und macht `WebsiteMonitorService`s
  // `res.ok`-Prüfung nebenbei robuster (siehe website-monitor.service.ts).
  if (await isInstanceLocked()) {
    return NextResponse.rewrite(internalUrl(request, "/locked"), {
      status: 503,
    });
  }

  const accessToken = request.cookies.get(ACCESS_TOKEN_COOKIE)?.value;
  const refreshToken = request.cookies.get(REFRESH_TOKEN_COOKIE)?.value;

  if (pathname.startsWith(PROTECTED_PREFIX)) {
    if (accessToken) {
      return applyLockoutRedirect(request, accessToken, NextResponse.next());
    }

    if (refreshToken) {
      const refreshed = await tryRefresh(refreshToken, {
        userAgent: request.headers.get("user-agent"),
        forwardedFor:
          request.headers.get("x-forwarded-for") ??
          request.headers.get("x-real-ip"),
      });
      if (refreshed) {
        return applyLockoutRedirect(
          request,
          refreshed.accessToken,
          applyAuthCookies(NextResponse.next(), refreshed),
        );
      }
    }

    const loginUrl = internalUrl(request, "/login");
    loginUrl.searchParams.set("redirectTo", pathname);
    return clearAuthCookies(NextResponse.redirect(loginUrl));
  }

  if (
    (pathname === "/login" || pathname === "/register") &&
    (accessToken || refreshToken)
  ) {
    return NextResponse.redirect(internalUrl(request, "/dashboard"));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/login", "/register"],
};
