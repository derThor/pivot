import { NextResponse } from "next/server";

const API_URL = process.env.API_URL ?? "http://localhost:3001/v1";

// Formular-Baustein: `[id]` ist hier der Formular-Slug (öffentlicher
// Absende-Endpunkt, siehe forms.controller.ts `POST /forms/:slug/submit`).
// Unauthentifiziert wie `forms/public/[id]`, daher kein `proxyToApi()`.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await request.json();

  const forwardedFor = request.headers.get("x-forwarded-for");
  const backendRes = await fetch(`${API_URL}/forms/${id}/submit`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(forwardedFor ? { "x-forwarded-for": forwardedFor } : {}),
    },
    body: JSON.stringify(body),
  });
  const data = await backendRes.json().catch(() => null);
  return NextResponse.json(data, { status: backendRes.status });
}
