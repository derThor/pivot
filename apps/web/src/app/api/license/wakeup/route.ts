import { NextResponse } from "next/server";

const API_URL = process.env.API_URL ?? "http://localhost:3001/v1";

/** Öffentlicher Passthrough für den Master-"Wecken"-Aufruf (siehe
 * knowledge-base/platform/master-slave-licensing.md) – bewusst NICHT über
 * `proxyToApi()` (das erwartet ein eingeloggtes Dashboard-Nutzer-Cookie),
 * da der Aufrufer hier der Master selbst ist, authentifiziert über den
 * geteilten `LICENSE_API_KEY` im Authorization-Header, nicht über eine
 * Nutzer-Session. */
export async function POST(request: Request) {
  const authorization = request.headers.get("authorization");
  const res = await fetch(`${API_URL}/license/wakeup`, {
    method: "POST",
    headers: authorization ? { Authorization: authorization } : {},
    cache: "no-store",
  });
  const data = await res.json().catch(() => null);
  return NextResponse.json(data, { status: res.status });
}
