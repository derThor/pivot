import { proxyToApi } from "@/lib/bff-proxy";

export async function GET(request: Request) {
  const { search } = new URL(request.url);
  return proxyToApi("GET", `/content${search}`);
}

export async function POST(request: Request) {
  const body = await request.json();
  return proxyToApi("POST", "/content", body);
}
