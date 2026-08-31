import { BASE_PATH } from "@/lib/bff";

const isProd = process.env.NODE_ENV === "production";

export const ACCESS_TOKEN_COOKIE = "access_token";
export const REFRESH_TOKEN_COOKIE = "refresh_token";
export const AUTH_COOKIE_NAMES = [
  ACCESS_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE,
] as const;

// "Als Nutzer ansehen" (2b.14): während der Impersonation liegt hier eine
// Sicherung der eigenen Zugangsdaten, damit "Zurück zu deinem Konto" sie
// wiederherstellen kann, statt den Admin komplett auszuloggen. Siehe
// /api/users/[id]/impersonate und /api/auth/stop-impersonation.
export const ADMIN_ACCESS_TOKEN_COOKIE = "admin_access_token";
export const ADMIN_REFRESH_TOKEN_COOKIE = "admin_refresh_token";

// Pfad = Backend-Präfix, nicht "/": Backend und öffentliche Website teilen
// sich dieselbe Domain (siehe knowledge-base/platform/deployment.md). Mit
// path "/" würde das Sitzungs-Cookie bei JEDEM Besucher-Request an die
// öffentliche Website mitgeschickt – unnötige Übertragung, und ein
// vorgelagertes CDN cached Antworten mit Cookies üblicherweise nicht.
export const baseCookieOptions = {
  httpOnly: true,
  secure: isProd,
  sameSite: "lax" as const,
  path: BASE_PATH || "/",
};

/** Zum Loeschen MUSS derselbe Pfad angegeben werden wie beim Setzen -
 * sonst trifft das Loeschen die Cookies unter /admin nicht und der
 * Abmelden-Knopf bleibt wirkungslos (Fehler vom 2026-08-31, entstanden
 * beim Umzug des Backends unter den /admin-Pfad). */
export function authCookieDeleteOptions(name: string) {
  return { name, path: baseCookieOptions.path };
}

/** Loeschen ueber `cookies().delete()`/`response.cookies.delete()` legt
 * die Set-Cookie-Zeilen in einer Map ab, die nach dem NAMEN schluesselt -
 * zwei Loeschungen desselben Cookies mit verschiedenen Pfaden ueber-
 * schreiben sich dabei gegenseitig, und nur die letzte landet in der
 * Antwort. Deshalb werden die Zeilen hier direkt angehaengt. */
export function appendAuthCookieDeletions(
  headers: Headers,
  names: readonly string[],
) {
  const paths = [...new Set([baseCookieOptions.path, "/"])];
  for (const name of names) {
    for (const path of paths) {
      headers.append(
        "set-cookie",
        `${name}=; Path=${path}; Max-Age=0; HttpOnly; SameSite=Lax${
          isProd ? "; Secure" : ""
        }`,
      );
    }
  }
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

// `remember=false` (Login-Formular "Angemeldet bleiben" abgewählt): das
// Refresh-Cookie bekommt keine `maxAge` und wird damit zum reinen
// Session-Cookie (verschwindet beim Schließen des Browsers), statt wie im
// Standardfall 30 Tage zu gelten.
export function buildAuthCookies(tokens: TokenPair, remember = true) {
  return [
    {
      name: ACCESS_TOKEN_COOKIE,
      value: tokens.accessToken,
      options: { ...baseCookieOptions, maxAge: 15 * 60 },
    },
    {
      name: REFRESH_TOKEN_COOKIE,
      value: tokens.refreshToken,
      options: remember
        ? { ...baseCookieOptions, maxAge: 30 * 24 * 60 * 60 }
        : baseCookieOptions,
    },
  ];
}
