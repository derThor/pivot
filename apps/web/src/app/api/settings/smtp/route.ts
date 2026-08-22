import { proxyToApi } from "@/lib/bff-proxy";

export async function GET() {
  return proxyToApi("GET", "/settings/smtp");
}

export async function PATCH(request: Request) {
  const body = await request.json();
  return proxyToApi("PATCH", "/settings/smtp", body);
}
