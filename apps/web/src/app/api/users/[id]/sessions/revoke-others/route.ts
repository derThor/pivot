import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { buildAuthCookies } from "@/lib/auth";
import { resolveAccessToken } from "@/lib/bff-proxy";

const API_URL = process.env.API_URL ?? "http://localhost:3001/v1";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const cookieStore = await cookies();
  const resolved = await resolveAccessToken(cookieStore);
  if (!resolved) {
    return NextResponse.json({ message: "Nicht angemeldet." }, { status: 401 });
  }
  const { accessToken, refreshTokenCookie, refreshed } = resolved;

  const { id } = await params;

  const backendRes = await fetch(
    `${API_URL}/users/${id}/sessions/revoke-others`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        ...(refreshTokenCookie && {
          "x-current-refresh-token": refreshTokenCookie,
        }),
      },
    },
  );

  const response =
    backendRes.status === 204
      ? new NextResponse(null, { status: 204 })
      : NextResponse.json(await backendRes.json().catch(() => null), {
          status: backendRes.status,
        });
  if (refreshed) {
    for (const cookie of buildAuthCookies(refreshed)) {
      response.cookies.set(cookie.name, cookie.value, cookie.options);
    }
  }
  return response;
}
