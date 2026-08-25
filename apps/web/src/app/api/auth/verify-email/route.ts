import { NextResponse } from "next/server";

const API_URL = process.env.API_URL ?? "http://localhost:3001/v1";

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token");
  if (!token) {
    return NextResponse.json(
      { message: "Kein Token übergeben." },
      { status: 400 },
    );
  }

  const backendRes = await fetch(
    `${API_URL}/auth/verify-email?token=${encodeURIComponent(token)}`,
  );

  const data = await backendRes.json().catch(() => null);
  return NextResponse.json(data, { status: backendRes.status });
}
