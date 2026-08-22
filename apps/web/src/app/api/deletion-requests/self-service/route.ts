import { proxyToApi } from "@/lib/bff-proxy";

export async function GET() {
  return proxyToApi("GET", "/deletion-requests/self-service");
}

export async function POST(request: Request) {
  const body = await request.json();
  return proxyToApi("POST", "/deletion-requests/self-service", body);
}
