import { proxyToApi } from "@/lib/bff-proxy";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; itemId: string }> },
) {
  const { id, itemId } = await params;
  const body = await request.json().catch(() => ({}));
  return proxyToApi("PATCH", `/navigations/${id}/items/${itemId}`, body);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; itemId: string }> },
) {
  const { id, itemId } = await params;
  return proxyToApi("DELETE", `/navigations/${id}/items/${itemId}`);
}
