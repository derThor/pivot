import { proxyToApi } from "@/lib/bff-proxy";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  return proxyToApi(
    "PATCH",
    `/frontend-templates/${encodeURIComponent(id)}`,
    body,
  );
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return proxyToApi("DELETE", `/frontend-templates/${encodeURIComponent(id)}`);
}
