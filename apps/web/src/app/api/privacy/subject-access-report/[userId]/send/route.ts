import { proxyToApi } from "@/lib/bff-proxy";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ userId: string }> },
) {
  const { userId } = await params;
  return proxyToApi("POST", `/privacy/subject-access-report/${userId}/send`);
}
