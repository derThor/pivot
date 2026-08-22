import { proxyToApi } from "@/lib/bff-proxy";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return proxyToApi("GET", `/privacy-incidents/${id}/report`);
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return proxyToApi("POST", `/privacy-incidents/${id}/report`);
}
