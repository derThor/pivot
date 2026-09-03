const API_URL = process.env.API_URL ?? "http://localhost:3001/v1";

/** Basis-URL der öffentlichen Website (`apps/site`) aus Sicht der
 * Administration. Gemeinsam genutzt von der Seitenvorschau
 * (`content/[id]/frontend-preview`) und vom Leeren des Frontend-Caches
 * (`settings/clear-frontend-cache`) – 2026-09-03 hierher gezogen, damit es
 * die Staffelung nur EINMAL gibt.
 *
 * Bewusst so gestaffelt, dass die Vorschau **ohne jede Konfiguration**
 * funktioniert (Nutzervorgabe, 2026-09-02: "kann man es so bauen, dass das
 * frontend immer aufrufbar ist als vorschau für seiten? ohne eintragung in
 * einstellung frontend?") – eine gepflegte Einstellung hat aber immer
 * Vorrang:
 *
 * 1. `AppSettings.publicBaseUrl` (Einstellungen → Frontend) – die einzige
 *    Quelle, die auch die echte öffentliche Domain kennt.
 * 2. `SITE_URL` aus der Umgebung – für Deployments, die die Website unter
 *    einer anderen Adresse betreiben als das Backend.
 * 3. Entwicklung: fest `http://localhost:3002`. `apps/site` startet laut
 *    seiner package.json auf diesem Port (`next dev --port 3002`), das ist
 *    also kein geratener Wert. Deckt beide lokalen Fälle ab – den direkten
 *    Aufruf über Port 3000 genauso wie den über `pnpm dev:proxy`.
 *
 *    ACHTUNG bei einer ZWEITEN Installation auf derselben Maschine: die
 *    kann nicht auch auf 3002 laufen, und dieser Rückfall zeigt dann auf
 *    die Website der ersten – also auf fremde Inhalte. Solche
 *    Installationen setzen `SITE_URL` (Schritt 2). Aufgefallen am
 *    2026-09-03 an der Testinstallation "strasev" (Backend 3010, API 3011,
 *    Website 3012).
 * 4. Produktion ohne alles: dieselbe Origin. Das trifft das dokumentierte
 *    Ein-Domain-Layout (`/` Website, `/admin` Backend, siehe
 *    knowledge-base/platform/deployment.md); der `/admin`-Basispfad fällt
 *    dabei automatisch weg, weil `URL.origin` den Pfad nicht enthält.
 */
export async function resolveSiteBaseUrl(request: Request): Promise<string> {
  const stripSlash = (url: string) => url.replace(/\/+$/, "");

  const res = await fetch(`${API_URL}/public/site`, { cache: "no-store" });
  const site = res.ok
    ? ((await res.json()) as { publicBaseUrl: string | null })
    : null;
  if (site?.publicBaseUrl) return stripSlash(site.publicBaseUrl);

  if (process.env.SITE_URL) return stripSlash(process.env.SITE_URL);

  if (process.env.NODE_ENV !== "production") return "http://localhost:3002";

  return new URL(request.url).origin;
}
