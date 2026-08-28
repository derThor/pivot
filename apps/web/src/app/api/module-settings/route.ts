import { proxyToApi } from "@/lib/bff-proxy";

export async function GET() {
  return proxyToApi("GET", "/module-settings");
}
