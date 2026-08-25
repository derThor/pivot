import { proxyToApi } from "@/lib/bff-proxy";

export async function POST(request: Request) {
  const formData = await request.formData();
  return proxyToApi("POST", "/auth/me/avatar", formData);
}
