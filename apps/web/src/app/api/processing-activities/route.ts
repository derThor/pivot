import { proxyToApi } from "@/lib/bff-proxy";

export async function POST(request: Request) {
  const body = await request.json();
  return proxyToApi("POST", "/processing-activities", body);
}
