import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  AUTH_COOKIE_NAMES,
  REFRESH_TOKEN_COOKIE,
  authCookieDeleteTargets,
} from "@/lib/auth";

const API_URL = process.env.API_URL ?? "http://localhost:3001/v1";

export async function POST() {
  const cookieStore = await cookies();
  const refreshToken = cookieStore.get(REFRESH_TOKEN_COOKIE)?.value;

  if (refreshToken) {
    await fetch(`${API_URL}/auth/logout`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    }).catch(() => null);
  }

  for (const name of AUTH_COOKIE_NAMES) {
    for (const target of authCookieDeleteTargets(name)) {
      cookieStore.delete(target);
    }
  }

  return NextResponse.json({ success: true });
}
