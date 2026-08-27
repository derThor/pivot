import { proxyToApi } from "@/lib/bff-proxy";

export async function GET() {
  return proxyToApi("GET", "/mandanten");
}

export async function POST(request: Request) {
  const body = await request.json();
  return proxyToApi("POST", "/mandanten", body);
}
