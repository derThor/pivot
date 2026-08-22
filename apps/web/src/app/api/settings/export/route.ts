import { proxyToApi } from "@/lib/bff-proxy";

export async function GET() {
  return proxyToApi("GET", "/settings/export");
}
