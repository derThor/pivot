import { proxyToApi } from "@/lib/bff-proxy";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; moduleKey: string }> },
) {
  const { id, moduleKey } = await params;
  const body = await request.json();
  return proxyToApi("PATCH", `/mandanten/${id}/modules/${moduleKey}`, body);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; moduleKey: string }> },
) {
  const { id, moduleKey } = await params;
  return proxyToApi("DELETE", `/mandanten/${id}/modules/${moduleKey}`);
}
