import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  ACCESS_TOKEN_COOKIE,
  ADMIN_ACCESS_TOKEN_COOKIE,
  ADMIN_REFRESH_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE,
} from "@/lib/auth";

const API_URL = process.env.API_URL ?? "http://localhost:3001/v1";
const isProd = process.env.NODE_ENV === "production";
const cookieOptions = {
  httpOnly: true,
  secure: isProd,
  sameSite: "lax" as const,
  path: "/",
};

// Startet "Als Nutzer ansehen": sichert die eigenen Tokens des Admins unter
// admin_*-Cookies (siehe lib/auth.ts) und ersetzt access_token durch den
// kurzlebigen Impersonation-Token. Kein neues refresh_token – die
// Impersonation-Sitzung läuft nach 15 Min. von selbst aus, "Zurück zu
// deinem Konto" (siehe /api/auth/stop-impersonation) stellt die eigenen
// Tokens vorher wieder her.
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get(ACCESS_TOKEN_COOKIE)?.value;
  const refreshToken = cookieStore.get(REFRESH_TOKEN_COOKIE)?.value;
  if (!accessToken) {
    return NextResponse.json({ message: "Nicht angemeldet." }, { status: 401 });
  }

  const { id } = await params;

  const backendRes = await fetch(`${API_URL}/users/${id}/impersonate`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!backendRes.ok) {
    const data = await backendRes.json().catch(() => null);
    return NextResponse.json(data, { status: backendRes.status });
  }

  const { accessToken: impersonationToken } = await backendRes.json();

  cookieStore.set(ADMIN_ACCESS_TOKEN_COOKIE, accessToken, cookieOptions);
  if (refreshToken) {
    cookieStore.set(ADMIN_REFRESH_TOKEN_COOKIE, refreshToken, cookieOptions);
  }
  cookieStore.set(ACCESS_TOKEN_COOKIE, impersonationToken, {
    ...cookieOptions,
    maxAge: 15 * 60,
  });
  cookieStore.delete(REFRESH_TOKEN_COOKIE);

  return NextResponse.json({ success: true });
}
