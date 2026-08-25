import { proxyToApi } from "@/lib/bff-proxy";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return proxyToApi("GET", `/media/${id}/usage`);
}
