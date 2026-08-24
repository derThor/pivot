import { proxyToApi } from "@/lib/bff-proxy";

export async function GET() {
  return proxyToApi("GET", "/settings/license-client");
}

export async function PATCH(request: Request) {
  const body = await request.json();
  return proxyToApi("PATCH", "/settings/license-client", body);
}
