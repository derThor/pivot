import { proxyToApi } from "@/lib/bff-proxy";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return proxyToApi("DELETE", `/privacy/retention/access-log/${id}`);
}
