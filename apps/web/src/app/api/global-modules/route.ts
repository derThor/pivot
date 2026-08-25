import { proxyToApi } from "@/lib/bff-proxy";

export async function GET() {
  return proxyToApi("GET", "/global-modules");
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  return proxyToApi("POST", "/global-modules", body);
}
