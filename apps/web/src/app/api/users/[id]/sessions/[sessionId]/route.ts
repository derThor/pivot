import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { ACCESS_TOKEN_COOKIE } from "@/lib/auth";

const API_URL = process.env.API_URL ?? "http://localhost:3001/v1";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; sessionId: string }> },
) {
  const accessToken = (await cookies()).get(ACCESS_TOKEN_COOKIE)?.value;
  if (!accessToken) {
    return NextResponse.json({ message: "Nicht angemeldet." }, { status: 401 });
  }

  const { id, sessionId } = await params;

  const backendRes = await fetch(
    `${API_URL}/users/${id}/sessions/${sessionId}`,
    { method: "DELETE", headers: { Authorization: `Bearer ${accessToken}` } },
  );

  if (backendRes.status === 204) {
    return new NextResponse(null, { status: 204 });
  }
  const data = await backendRes.json().catch(() => null);
  return NextResponse.json(data, { status: backendRes.status });
}
