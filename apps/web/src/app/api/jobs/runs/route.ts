import { proxyToApi } from "@/lib/bff-proxy";

export async function GET(request: Request) {
  const { search } = new URL(request.url);
  return proxyToApi("GET", `/jobs/runs${search}`);
}

export async function DELETE() {
  return proxyToApi("DELETE", "/jobs/runs");
}
