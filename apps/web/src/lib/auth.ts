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
const baseCookieOptions = {
  httpOnly: true,
  secure: isProd,
  sameSite: "lax" as const,
  path: BASE_PATH || "/",
};

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
