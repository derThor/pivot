import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  ACCESS_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE,
  buildAuthCookies,
  type TokenPair,
} from "@/lib/auth";

const API_URL = process.env.API_URL ?? "http://localhost:3001/v1";

/** Erneuert das Zugriffstoken über das Refresh-Cookie – gleiches Prinzip
 * wie middleware.ts' `tryRefresh()`, hier aber in der normalen Node-
 * Runtime (nicht Edge), da BFF-Routen keine Middleware sind. Nötig, weil
 * middleware.ts nur bei echten Seitenaufrufen läuft, nicht bei
 * client-seitigen `fetch()`-Aufrufen auf `/api/*` – ein länger geöffneter
 * Dialog (z.B. "Website bearbeiten") lief nach Ablauf des 15-Minuten-
 * Zugriffstokens deshalb bisher in einen rohen 401, obwohl die Sitzung
 * über das Refresh-Cookie eigentlich noch gültig war (Nutzer-Bugreport,
 * 2026-08-25: "kann keinen neuen Key mehr erzeugen"). */
async function tryRefresh(refreshToken: string): Promise<TokenPair | null> {
  try {
    const res = await fetch(`${API_URL}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
      cache: "no-store",
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export interface ResolvedAccessToken {
  accessToken: string;
  // Der gerade gültige Refresh-Token-Wert (Original-Cookie, oder der neu
  // ausgestellte, falls gerade erneuert wurde) – für Routen, die ihn selbst
  // weiterreichen müssen (z.B. `x-current-refresh-token`-Header bei
  // "andere Sitzungen abmelden", oder zum Spiegeln in die admin_*-Cookies
  // bei der Impersonation).
  refreshTokenCookie: string | undefined;
  // Nur gesetzt, wenn gerade tatsächlich erneuert wurde – Aufrufer sollen
  // dann `buildAuthCookies(refreshed)` auf ihre Antwort anwenden, damit die
  // Erneuerung auch im Browser ankommt.
  refreshed: TokenPair | null;
}

/** Für die wenigen Routen mit Sonderlogik, die `proxyToApi()` nicht nutzen
 * können (Cookie-Swaps wie Impersonation, zusätzliche Header wie oben) –
 * liefert ein gültiges Zugriffstoken, erneuert bei Bedarf über das
 * Refresh-Cookie (gleiches Prinzip wie `proxyToApi()` selbst, siehe dessen
 * Kommentar zum "nach längerer Pause nicht angemeldet"-Bugreport).
 * `null` = nicht angemeldet (weder Zugriffs- noch gültiges Refresh-Token). */
export async function resolveAccessToken(
  cookieStore: Awaited<ReturnType<typeof cookies>>,
): Promise<ResolvedAccessToken | null> {
  const accessToken = cookieStore.get(ACCESS_TOKEN_COOKIE)?.value;
  const currentRefreshToken = cookieStore.get(REFRESH_TOKEN_COOKIE)?.value;
  if (accessToken) {
    return {
      accessToken,
      refreshTokenCookie: currentRefreshToken,
      refreshed: null,
    };
  }
  if (!currentRefreshToken) return null;
  const refreshed = await tryRefresh(currentRefreshToken);
  if (!refreshed) return null;
  return {
    accessToken: refreshed.accessToken,
    refreshTokenCookie: refreshed.refreshToken,
    refreshed,
  };
}

/** Gemeinsamer Kern für die BFF-Proxy-Routen der Datenschutz-Seite
 * (Nutzervorgabe, 2026-08-18) – bei ~20 fast identischen Routen (5 einfache
 * CRUD-Ressourcen + 4x Papierkorb-Unterrouten + Retention/Report) lohnt sich
 * die Bündelung, anders als bei den wenigen bestehenden Einzel-Routen
 * (company-locations etc.), die weiterhin je für sich hand-geschrieben
 * bleiben.
 *
 * Update 2026-08-25: bei einem abgelaufenen Zugriffstoken (401 vom Backend)
 * wird jetzt einmal automatisch per Refresh-Cookie erneuert und die Anfrage
 * wiederholt, statt den rohen 401 direkt durchzureichen – siehe
 * `tryRefresh()` oben.
 *
 * Update 2026-08-25, Nutzer-Bugreport ("nach längerer Pause 'nicht
 * angemeldet', F5 behebt es ohne erneutes Einloggen"): das Zugriffstoken-
 * Cookie hat nur 15 Min. `maxAge` und wird vom BROWSER nach Ablauf
 * komplett entfernt (nicht nur der JWT-Inhalt ungültig) – das Cookie fehlt
 * dann schon HIER, bevor überhaupt ein Backend-Aufruf versucht wird. Der
 * obige 401-Retry griff deshalb nie, weil der Code vorher schon mit
 * "Nicht angemeldet." abgebrochen ist, obwohl das Refresh-Cookie (30 Tage)
 * noch gültig war. F5 half nur, weil middleware.ts bei echten
 * Seitenaufrufen selbst erneuert – bei einem reinen `fetch()` auf `/api/*`
 * (keine Seitennavigation) lief das nie. Jetzt wird auch bei fehlendem
 * Zugriffstoken zuerst ein Refresh versucht, bevor aufgegeben wird. */
export async function proxyToApi(
  method: string,
  path: string,
  body?: unknown | FormData,
): Promise<NextResponse> {
  const cookieStore = await cookies();
  let accessToken = cookieStore.get(ACCESS_TOKEN_COOKIE)?.value;
  let refreshed: TokenPair | null = null;

  if (!accessToken) {
    const refreshToken = cookieStore.get(REFRESH_TOKEN_COOKIE)?.value;
    if (refreshToken) {
      refreshed = await tryRefresh(refreshToken);
      if (refreshed) accessToken = refreshed.accessToken;
    }
    if (!accessToken) {
      return NextResponse.json(
        { message: "Nicht angemeldet." },
        { status: 401 },
      );
    }
  }

  // FormData (Datei-Uploads) unverändert durchreichen – fetch/undici setzt
  // dafür selbst den passenden multipart-Boundary-Header; nur echte
  // JSON-Bodies werden stringifiziert und mit Content-Type versehen.
  const isFormData = body instanceof FormData;
  const doFetch = (token: string) =>
    fetch(`${API_URL}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(body !== undefined && !isFormData
          ? { "Content-Type": "application/json" }
          : {}),
      },
      ...(body !== undefined
        ? { body: isFormData ? body : JSON.stringify(body) }
        : {}),
      cache: "no-store",
    });

  let backendRes = await doFetch(accessToken);
  if (backendRes.status === 401 && !refreshed) {
    const refreshToken = cookieStore.get(REFRESH_TOKEN_COOKIE)?.value;
    if (refreshToken) {
      refreshed = await tryRefresh(refreshToken);
      if (refreshed) {
        backendRes = await doFetch(refreshed.accessToken);
      }
    }
  }

  if (backendRes.status === 204) {
    const response = new NextResponse(null, { status: 204 });
    if (refreshed) {
      for (const cookie of buildAuthCookies(refreshed)) {
        response.cookies.set(cookie.name, cookie.value, cookie.options);
      }
    }
    return response;
  }

  const contentType = backendRes.headers.get("content-type") ?? "";
  if (contentType.includes("text/csv")) {
    // arrayBuffer() statt text(): Response.text() dekodiert laut WHATWG-Spec
    // als UTF-8 und entfernt dabei ein führendes BOM automatisch – die Datei
    // kam dadurch beim Download ohne BOM an (Nutzer-Bugreport, 2026-08-19).
    const buffer = await backendRes.arrayBuffer();
    const response = new NextResponse(buffer, {
      status: backendRes.status,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition":
          backendRes.headers.get("content-disposition") ??
          'attachment; filename="bericht.csv"',
      },
    });
    if (refreshed) {
      for (const cookie of buildAuthCookies(refreshed)) {
        response.cookies.set(cookie.name, cookie.value, cookie.options);
      }
    }
    return response;
  }
  if (contentType.includes("application/zip")) {
    const buffer = await backendRes.arrayBuffer();
    const response = new NextResponse(buffer, {
      status: backendRes.status,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition":
          backendRes.headers.get("content-disposition") ??
          'attachment; filename="download.zip"',
      },
    });
    if (refreshed) {
      for (const cookie of buildAuthCookies(refreshed)) {
        response.cookies.set(cookie.name, cookie.value, cookie.options);
      }
    }
    return response;
  }

  const data = await backendRes.json().catch(() => null);
  const response = NextResponse.json(data, { status: backendRes.status });
  if (refreshed) {
    for (const cookie of buildAuthCookies(refreshed)) {
      response.cookies.set(cookie.name, cookie.value, cookie.options);
    }
  }
  return response;
}
