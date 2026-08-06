import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { buildAuthCookies } from "@/lib/auth";

const API_URL = process.env.API_URL ?? "http://localhost:3001/v1";

export async function POST(request: Request) {
  const body = await request.json();

  const backendRes = await fetch(`${API_URL}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!backendRes.ok) {
    const error = await backendRes.json().catch(() => null);
    return NextResponse.json(
      { message: error?.message ?? "Registrierung fehlgeschlagen." },
      { status: backendRes.status },
    );
  }

  const data = await backendRes.json();

  if (data.pendingActivation) {
    return NextResponse.json({
      success: true,
      pendingActivation: true,
      message: data.message,
      verificationLinkDevOnly: data.verificationLinkDevOnly,
    });
  }

  const cookieStore = await cookies();
  for (const cookie of buildAuthCookies(data)) {
    cookieStore.set(cookie.name, cookie.value, cookie.options);
  }

  return NextResponse.json({
    success: true,
    verificationLinkDevOnly: data.verificationLinkDevOnly,
  });
}
