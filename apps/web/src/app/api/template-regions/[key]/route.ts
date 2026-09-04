import { proxyToApi } from "@/lib/bff-proxy";

/** Inhalt eines Template-Bereichs (Kopfbereich, Fußbereich, …) – lesen und
 * speichern. Die Rechte prüft die API (`content:read`/`content:update`),
 * hier läuft nur die Weiterleitung mit dem Sitzungs-Token. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ key: string }> },
) {
  const { key } = await params;
  return proxyToApi("GET", `/template-regions/${encodeURIComponent(key)}`);
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ key: string }> },
) {
  const { key } = await params;
  const body = await request.json().catch(() => ({}));
  return proxyToApi(
    "PUT",
    `/template-regions/${encodeURIComponent(key)}`,
    body,
  );
}
