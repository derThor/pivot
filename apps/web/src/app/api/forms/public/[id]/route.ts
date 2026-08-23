import { NextResponse } from "next/server";

const API_URL = process.env.API_URL ?? "http://localhost:3001/v1";

// Formular-Baustein im Seiten-Designer (`ContentTypeField.type === "form"`)
// – rendert auch auf der anonymen Vorschau-Seite (`/preview/[token]`),
// braucht daher eine eigene, unauthentifizierte Route statt `proxyToApi()`
// (das immer den Access-Token-Cookie voraussetzt).
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const backendRes = await fetch(`${API_URL}/forms/public/${id}`, {
    cache: "no-store",
  });
  const data = await backendRes.json().catch(() => null);
  return NextResponse.json(data, { status: backendRes.status });
}
