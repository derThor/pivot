import { proxyToApi } from "@/lib/bff-proxy";

export async function GET() {
  return proxyToApi("GET", "/navigations");
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  return proxyToApi("POST", "/navigations", body);
}
