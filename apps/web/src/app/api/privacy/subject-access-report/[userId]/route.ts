import { proxyToApi } from "@/lib/bff-proxy";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ userId: string }> },
) {
  const { userId } = await params;
  return proxyToApi("GET", `/privacy/subject-access-report/${userId}`);
}
