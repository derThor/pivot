import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { ACCESS_TOKEN_COOKIE } from "@/lib/auth";

const API_URL = process.env.API_URL ?? "http://localhost:3001/v1";

// Bildet einen globalen Such-Treffertyp auf den passenden
// "auf welcher Seite liegt dieser Eintrag"-Endpoint im Backend ab.
const backendPath: Record<string, (id: string) => string> = {
  category: (id) => `/categories/${id}/page`,
  tag: (id) => `/tags/${id}/page`,
  media: (id) => `/media/${id}/page`,
  user: (id) => `/users/${id}/page`,
  role: (id) => `/roles/${id}/page`,
  previewLink: (id) => `/content/preview-links/${id}/page`,
};

export async function GET(request: Request) {
  const accessToken = (await cookies()).get(ACCESS_TOKEN_COOKIE)?.value;
  if (!accessToken) {
    return NextResponse.json({ message: "Nicht angemeldet." }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type") ?? "";
  const id = searchParams.get("id");
  const pageSize = searchParams.get("pageSize") ?? "10";

  const buildPath = backendPath[type];
  if (!buildPath || !id) {
    return NextResponse.json({ message: "Ungültige Anfrage." }, { status: 400 });
  }

  const backendRes = await fetch(
    `${API_URL}${buildPath(id)}?pageSize=${encodeURIComponent(pageSize)}`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    },
  );

  const data = await backendRes.json().catch(() => null);
  return NextResponse.json(data, { status: backendRes.status });
}
