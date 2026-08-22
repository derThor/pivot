import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { ACCESS_TOKEN_COOKIE } from "@/lib/auth";

const API_URL = process.env.API_URL ?? "http://localhost:3001/v1";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const accessToken = (await cookies()).get(ACCESS_TOKEN_COOKIE)?.value;
  if (!accessToken) {
    return NextResponse.json({ message: "Nicht angemeldet." }, { status: 401 });
  }

  const { id } = await params;

  const backendRes = await fetch(`${API_URL}/users/${id}/delete`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (backendRes.status === 204) {
    return new NextResponse(null, { status: 204 });
  }
  const data = await backendRes.json().catch(() => null);
  return NextResponse.json(data, { status: backendRes.status });
}
