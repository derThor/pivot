import { proxyToApi } from "@/lib/bff-proxy";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; submissionId: string }> },
) {
  const { id, submissionId } = await params;
  const body = await request.json();
  return proxyToApi("PATCH", `/forms/${id}/submissions/${submissionId}`, body);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; submissionId: string }> },
) {
  const { id, submissionId } = await params;
  return proxyToApi("DELETE", `/forms/${id}/submissions/${submissionId}`);
}
