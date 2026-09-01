import { proxyToApi } from "@/lib/bff-proxy";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return proxyToApi("POST", `/websites/${id}/dismiss-stats-anomaly`);
}
