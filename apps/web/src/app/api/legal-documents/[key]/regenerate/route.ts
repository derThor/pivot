import { proxyToApi } from "@/lib/bff-proxy";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ key: string }> },
) {
  const { key } = await params;
  return proxyToApi("POST", `/legal-documents/${key}/regenerate`);
}
