import { proxyToApi } from "@/lib/bff-proxy";

export async function GET(request: Request) {
  const { search } = new URL(request.url);
  return proxyToApi("GET", `/media${search}`);
}

export async function POST(request: Request) {
  const formData = await request.formData();
  return proxyToApi("POST", "/media", formData);
}
