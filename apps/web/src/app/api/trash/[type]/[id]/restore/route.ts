import { proxyToApi } from "@/lib/bff-proxy";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ type: string; id: string }> },
) {
  const { type, id } = await params;
  return proxyToApi("POST", `/trash/${type}/${id}/restore`);
}
