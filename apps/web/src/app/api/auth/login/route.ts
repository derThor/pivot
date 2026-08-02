import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { buildAuthCookies } from "@/lib/auth";

const API_URL = process.env.API_URL ?? "http://localhost:3001/v1";

export async function POST(request: Request) {
  const body = await request.json();

  const backendRes = await fetch(`${API_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
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
  for (const cookie of buildAuthCookies(tokens)) {
    cookieStore.set(cookie.name, cookie.value, cookie.options);
  }

  return NextResponse.json({ success: true });
}
