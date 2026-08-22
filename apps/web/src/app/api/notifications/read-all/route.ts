import { proxyToApi } from "@/lib/bff-proxy";

export async function POST() {
  return proxyToApi("POST", "/notifications/read-all");
}
