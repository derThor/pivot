import { proxyToApi } from "@/lib/bff-proxy";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; versionId: string }> },
) {
  const { id, versionId } = await params;
  return proxyToApi("DELETE", `/content/${id}/versions/${versionId}`);
}
