import { proxyToApi } from "@/lib/bff-proxy";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await request.json();
  return proxyToApi("POST", `/deletion-requests/${id}/follow-up`, body);
}
