import { proxyToApi } from "@/lib/bff-proxy";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ key: string }> },
) {
  const { key } = await params;
  const body = await request.json();
  return proxyToApi("PATCH", `/module-settings/${key}`, body);
}
