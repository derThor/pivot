import { proxyToApi } from "@/lib/bff-proxy";

export async function PATCH(request: Request) {
  const body = await request.json();
  return proxyToApi("PATCH", "/settings/privacy/dsb", body);
}
