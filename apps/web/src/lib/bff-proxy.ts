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
 * `tryRefresh()` oben. */
export async function proxyToApi(
  method: string,
  path: string,
  body?: unknown,
): Promise<NextResponse> {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get(ACCESS_TOKEN_COOKIE)?.value;
  if (!accessToken) {
    return NextResponse.json({ message: "Nicht angemeldet." }, { status: 401 });
  }

  const doFetch = (token: string) =>
    fetch(`${API_URL}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      cache: "no-store",
    });

  let backendRes = await doFetch(accessToken);
  let refreshed: TokenPair | null = null;
  if (backendRes.status === 401) {
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
