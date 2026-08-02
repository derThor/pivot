const isProd = process.env.NODE_ENV === "production";

export const ACCESS_TOKEN_COOKIE = "access_token";
export const REFRESH_TOKEN_COOKIE = "refresh_token";
export const AUTH_COOKIE_NAMES = [
  ACCESS_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE,
] as const;

const baseCookieOptions = {
  httpOnly: true,
  secure: isProd,
  sameSite: "lax" as const,
  path: "/",
};

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export function buildAuthCookies(tokens: TokenPair) {
  return [
    {
      name: ACCESS_TOKEN_COOKIE,
      value: tokens.accessToken,
      options: { ...baseCookieOptions, maxAge: 15 * 60 },
    },
    {
      name: REFRESH_TOKEN_COOKIE,
      value: tokens.refreshToken,
      options: { ...baseCookieOptions, maxAge: 30 * 24 * 60 * 60 },
    },
  ];
}
