import { proxyToApi } from "@/lib/bff-proxy";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  const { sessionId } = await params;
  return proxyToApi("DELETE", `/auth/me/sessions/${sessionId}`);
}
