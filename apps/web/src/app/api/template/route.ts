import type { TemplateManifest } from "@pivot/blocks";

import { resolveSiteBaseUrl } from "@/lib/site-base-url";

/**
 * Holt das Manifest des Frontend-Templates dieser Installation und reicht
 * es an die Oberfläche durch (Einstellungen → Frontend → Darstellung).
 *
 * **Warum über die Website und nicht über die API:** das Manifest gehört
 * zum Template und liegt in dessen Code (`apps/site/src/template/
 * manifest.ts`). Die Verwaltung fragt also dort, wo es lebt – so gibt es
 * keine zweite Wahrheit, die veralten könnte.
 *
 * Adresse der Website: dieselbe Staffelung wie Seitenvorschau und
 * Cache-Knopf (`resolveSiteBaseUrl`), inklusive `SITE_URL` für eine
 * zweite Installation auf derselben Maschine.
 *
 * **Kein Manifest ist kein Fehler:** ältere oder fremde Templates bringen
 * keins mit (dann 404, oder die Website läuft gerade nicht). Die Antwort
 * ist dann `{ manifest: null }` mit Status 200 – die Oberfläche zeigt
 * einen Hinweis statt einer Fehlermeldung, und der Rest der Einstellungen
 * bleibt bedienbar.
 */
export async function GET(request: Request) {
  const base = await resolveSiteBaseUrl(request);
  try {
    const res = await fetch(`${base}/api/template`, { cache: "no-store" });
    if (!res.ok) return Response.json({ manifest: null, reason: res.status });
    const manifest = (await res.json()) as TemplateManifest;
    return Response.json({ manifest });
  } catch {
    // Website nicht erreichbar (Entwicklung: nicht gestartet). Auch das
    // ist kein Fehler der Verwaltung.
    return Response.json({ manifest: null, reason: "unreachable" });
  }
}
