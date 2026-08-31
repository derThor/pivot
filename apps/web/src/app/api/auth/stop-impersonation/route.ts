import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  ACCESS_TOKEN_COOKIE,
  ADMIN_ACCESS_TOKEN_COOKIE,
  ADMIN_REFRESH_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE,
  authCookieDeleteOptions,
  baseCookieOptions,
} from "@/lib/auth";

// Bewusst die gemeinsamen Optionen aus lib/auth.ts (inkl. Pfad!) statt
// einer lokalen Kopie - siehe authCookieDeleteOptions().
const cookieOptions = baseCookieOptions;

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
  cookieStore.delete(authCookieDeleteOptions(ADMIN_ACCESS_TOKEN_COOKIE));
  cookieStore.delete(authCookieDeleteOptions(ADMIN_REFRESH_TOKEN_COOKIE));

  return NextResponse.json({ success: true });
}
