import { proxyToApi } from "@/lib/bff-proxy";

export async function GET() {
  return proxyToApi("GET", "/data-processors/contracts.zip");
}
