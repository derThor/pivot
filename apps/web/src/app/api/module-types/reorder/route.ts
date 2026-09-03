import { proxyToApi } from "@/lib/bff-proxy";

/** Reihenfolge der Baustein-Palette (Nutzervorgabe, 2026-09-03). Reicht
 * die Id-Liste an die API durch; die Berechtigung (`content:update`)
 * prüft dort der Controller. */
export async function PATCH(request: Request) {
  const body = await request.json();
  return proxyToApi("PATCH", "/module-types/reorder", body);
}
