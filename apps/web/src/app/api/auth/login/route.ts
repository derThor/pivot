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

  const backendRes = await fetch(`${API_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
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
  const cookieStore = await cookies();
  for (const cookie of buildAuthCookies(tokens, remember !== false)) {
    cookieStore.set(cookie.name, cookie.value, cookie.options);
  }

  return NextResponse.json({ success: true });
}
