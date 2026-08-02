import { NextRequest, NextResponse } from "next/server";
import {
  ACCESS_TOKEN_COOKIE,
  AUTH_COOKIE_NAMES,
  REFRESH_TOKEN_COOKIE,
  buildAuthCookies,
  type TokenPair,
} from "@/lib/auth";

const API_URL = process.env.API_URL ?? "http://localhost:3001/v1";
const PROTECTED_PREFIX = "/dashboard";

async function tryRefresh(refreshToken: string): Promise<TokenPair | null> {
  try {
    const res = await fetch(`${API_URL}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
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
    response.cookies.delete(name);
  }
  return response;
}

function applyAuthCookies(response: NextResponse, tokens: TokenPair) {
  for (const cookie of buildAuthCookies(tokens)) {
    response.cookies.set(cookie.name, cookie.value, cookie.options);
  }
  return response;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const accessToken = request.cookies.get(ACCESS_TOKEN_COOKIE)?.value;
  const refreshToken = request.cookies.get(REFRESH_TOKEN_COOKIE)?.value;

  if (pathname.startsWith(PROTECTED_PREFIX)) {
    if (accessToken) {
      return NextResponse.next();
    }

    if (refreshToken) {
      const refreshed = await tryRefresh(refreshToken);
      if (refreshed) {
        return applyAuthCookies(NextResponse.next(), refreshed);
      }
    }

    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirectTo", pathname);
    return clearAuthCookies(NextResponse.redirect(loginUrl));
  }

  if (pathname === "/login" && (accessToken || refreshToken)) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/login"],
};
