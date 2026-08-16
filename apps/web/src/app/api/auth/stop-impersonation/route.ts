import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  ACCESS_TOKEN_COOKIE,
  ADMIN_ACCESS_TOKEN_COOKIE,
  ADMIN_REFRESH_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE,
} from "@/lib/auth";

const isProd = process.env.NODE_ENV === "production";
const cookieOptions = {
  httpOnly: true,
  secure: isProd,
  sameSite: "lax" as const,
  path: "/",
};

// "Zurück zu deinem Konto": stellt die vor der Impersonation gesicherten
// admin_*-Cookies wieder als access_token/refresh_token her (siehe
// /api/users/[id]/impersonate).
export async function POST() {
  const cookieStore = await cookies();
  const adminAccessToken = cookieStore.get(ADMIN_ACCESS_TOKEN_COOKIE)?.value;
  const adminRefreshToken = cookieStore.get(ADMIN_REFRESH_TOKEN_COOKIE)?.value;

  if (!adminAccessToken) {
    return NextResponse.json(
      { message: "Keine Impersonation aktiv." },
      { status: 400 },
    );
  }

  cookieStore.set(ACCESS_TOKEN_COOKIE, adminAccessToken, {
    ...cookieOptions,
    maxAge: 15 * 60,
  });
  if (adminRefreshToken) {
    cookieStore.set(REFRESH_TOKEN_COOKIE, adminRefreshToken, {
      ...cookieOptions,
      maxAge: 30 * 24 * 60 * 60,
    });
  }
  cookieStore.delete(ADMIN_ACCESS_TOKEN_COOKIE);
  cookieStore.delete(ADMIN_REFRESH_TOKEN_COOKIE);

  return NextResponse.json({ success: true });
}
