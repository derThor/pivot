import { proxyToApi } from "@/lib/bff-proxy";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; linkId: string }> },
) {
  const { id, linkId } = await params;
  const body = await request.json().catch(() => ({}));
  return proxyToApi("PATCH", `/content/${id}/preview-links/${linkId}`, body);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; linkId: string }> },
) {
  const { id, linkId } = await params;
  return proxyToApi("DELETE", `/content/${id}/preview-links/${linkId}`);
}
