import { proxyToApi } from "@/lib/bff-proxy";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const { search } = new URL(request.url);
  return proxyToApi("GET", `/forms/${id}/submissions${search}`);
}
