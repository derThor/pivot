import { NextResponse } from "next/server";

const API_URL = process.env.API_URL ?? "http://localhost:3001/v1";

// Öffentlicher, unauthentifizierter Passthrough zu GET /license/state
// (Nutzer-Bugreport, 2026-08-25: "Toast kommt nicht sofort und
// zuverlässig bei Entwicklerstatus") – client-seitig aus
// license-development-toast.tsx aufgerufen, damit der Status aktiv
// überwacht werden kann statt sich auf einen einmaligen Server-Snapshot
// von dashboard/layout.tsx zu verlassen. Kein proxyToApi() nötig: der
// Backend-Endpunkt selbst ist bereits @Public(), keine Auth involviert.
export async function GET() {
  const res = await fetch(`${API_URL}/license/state`, { cache: "no-store" });
  const data = await res.json().catch(() => null);
  return NextResponse.json(data, { status: res.status });
}
