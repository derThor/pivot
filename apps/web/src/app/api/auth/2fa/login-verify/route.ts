import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { buildAuthCookies } from "@/lib/auth";

const API_URL = process.env.API_URL ?? "http://localhost:3001/v1";

export async function POST(request: Request) {
  // Kein Access-Token nötig: der Client hat nach dem ersten Login-Schritt
  // (2FA aktiv) nur das Challenge-Token, keine Session – siehe
  // /api/auth/login und AuthService.loginWithTwoFactor().
  const { remember, ...body } = await request.json();

  const userAgent = request.headers.get("user-agent");
  const forwardedFor =
    request.headers.get("x-forwarded-for") ?? request.headers.get("x-real-ip");

  const backendRes = await fetch(`${API_URL}/auth/2fa/login-verify`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(userAgent && { "user-agent": userAgent }),
      ...(forwardedFor && { "x-forwarded-for": forwardedFor }),
    },
    body: JSON.stringify(body),
  });

  if (!backendRes.ok) {
    const error = await backendRes.json().catch(() => null);
    return NextResponse.json(
      { message: error?.message ?? "Code konnte nicht bestätigt werden." },
      { status: backendRes.status },
    );
  }

  const tokens = await backendRes.json();
  const cookieStore = await cookies();
  for (const cookie of buildAuthCookies(tokens, remember !== false)) {
    cookieStore.set(cookie.name, cookie.value, cookie.options);
  }

  return NextResponse.json({ success: true });
}
