import { proxyToApi } from "@/lib/bff-proxy";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ key: string; featureKey: string }> },
) {
  const { key, featureKey } = await params;
  const body = await request.json();
  return proxyToApi("PATCH", `/module-settings/${key}/features/${featureKey}`, body);
}
