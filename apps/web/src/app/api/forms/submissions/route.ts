import { proxyToApi } from "@/lib/bff-proxy";

// App-weite Einsendungen-Sammelübersicht – eigene Route statt `[id]`, muss
// in Next.js (wie im Backend) nicht extra vor `[id]` stehen, da "submissions"
// ein statisches Segment ist und Next statische vor dynamischen Segmenten
// bevorzugt.
export async function GET(request: Request) {
  const { search } = new URL(request.url);
  return proxyToApi("GET", `/forms/submissions${search}`);
}
