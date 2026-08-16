import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE } from "@/lib/auth";

const API_URL = process.env.API_URL ?? "http://localhost:3001/v1";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get(ACCESS_TOKEN_COOKIE)?.value;
  if (!accessToken) {
    return NextResponse.json({ message: "Nicht angemeldet." }, { status: 401 });
  }
  const refreshToken = cookieStore.get(REFRESH_TOKEN_COOKIE)?.value;

  const { id } = await params;

  const backendRes = await fetch(`${API_URL}/users/${id}/sessions`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(refreshToken && { "x-current-refresh-token": refreshToken }),
    },
    cache: "no-store",
  });

  const data = await backendRes.json().catch(() => null);
  return NextResponse.json(data, { status: backendRes.status });
}
