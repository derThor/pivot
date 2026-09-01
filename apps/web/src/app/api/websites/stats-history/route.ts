import { proxyToApi } from "@/lib/bff-proxy";

export async function DELETE() {
  return proxyToApi("DELETE", "/websites/stats-history");
}
