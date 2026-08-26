import { NextResponse } from "next/server";

const API_URL = process.env.API_URL ?? "http://localhost:3001/v1";

// Bewusst KEIN `proxyToApi()` (das verlangt ein Auth-Cookie und antwortet
// sonst mit "Nicht angemeldet.") – dieser Aufruf kommt von der öffentlichen
// Wartungsseite eines Besuchers ohne jede Sitzung, siehe
// license-recovery-dialog.tsx.
export async function POST(request: Request) {
  const body = await request.json();
  const backendRes = await fetch(`${API_URL}/license/recovery/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  const data = await backendRes.json().catch(() => null);
  return NextResponse.json(data, { status: backendRes.status });
}
