import { proxyToApi } from "@/lib/bff-proxy";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; sessionId: string }> },
) {
  const { id, sessionId } = await params;
  return proxyToApi("DELETE", `/users/${id}/sessions/${sessionId}`);
}
