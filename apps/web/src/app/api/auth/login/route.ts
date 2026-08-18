import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { buildAuthCookies } from "@/lib/auth";

const API_URL = process.env.API_URL ?? "http://localhost:3001/v1";

export async function POST(request: Request) {
  // `remember` ist rein clientseitig fürs Cookie-Verhalten hier (siehe
  // buildAuthCookies) – NICHT an die API weiterreichen: deren
  // ValidationPipe hat `forbidNonWhitelisted: true`, ein unbekanntes Feld
  // im Body würde den Login mit 400 ablehnen.
  const { remember, ...credentials } = await request.json();

  // `fetch()` hier läuft server-seitig und schickt sonst Nodes eigenen
  // User-Agent statt dem des echten Browsers – ohne explizite
  // Weiterreichung zeigt "Aktive Sitzungen" (2b.14) sonst nur "Unbekanntes
  // Gerät" statt z.B. "Windows · Chrome".
  const userAgent = request.headers.get("user-agent");
  const forwardedFor =
    request.headers.get("x-forwarded-for") ??
    request.headers.get("x-real-ip");

  const backendRes = await fetch(`${API_URL}/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(userAgent && { "user-agent": userAgent }),
      ...(forwardedFor && { "x-forwarded-for": forwardedFor }),
    },
    body: JSON.stringify(credentials),
  });

  if (!backendRes.ok) {
    const error = await backendRes.json().catch(() => null);
    return NextResponse.json(
      { message: error?.message ?? "Anmeldung fehlgeschlagen." },
      { status: backendRes.status },
    );
  }

  const tokens = await backendRes.json();

  // 2FA aktiv: statt Tokens nur ein kurzlebiges Challenge-Token, das der
  // Client an /api/auth/2fa/login-verify weiterreicht – noch keine Cookies.
  if (tokens.mfaRequired) {
    return NextResponse.json(tokens);
  }

  const cookieStore = await cookies();
  for (const cookie of buildAuthCookies(tokens, remember !== false)) {
    cookieStore.set(cookie.name, cookie.value, cookie.options);
  }

  return NextResponse.json({ success: true });
}
