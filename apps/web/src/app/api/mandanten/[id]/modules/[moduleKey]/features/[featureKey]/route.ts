import { proxyToApi } from "@/lib/bff-proxy";

export async function PATCH(
  request: Request,
  {
    params,
  }: { params: Promise<{ id: string; moduleKey: string; featureKey: string }> },
) {
  const { id, moduleKey, featureKey } = await params;
  const body = await request.json();
  return proxyToApi(
    "PATCH",
    `/mandanten/${id}/modules/${moduleKey}/features/${featureKey}`,
    body,
  );
}
