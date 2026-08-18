import { proxyToApi } from "@/lib/bff-proxy";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ type: string; id: string }> },
) {
  const { type, id } = await params;
  return proxyToApi("DELETE", `/trash/${type}/${id}`);
}
