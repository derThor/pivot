import { proxyToApi } from "@/lib/bff-proxy";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string; versionId: string }> },
) {
  const { id, versionId } = await params;
  return proxyToApi("POST", `/content/${id}/versions/${versionId}/rollback`);
}
