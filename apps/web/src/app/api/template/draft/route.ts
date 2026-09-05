import { resolveSiteBaseUrl } from "@/lib/site-base-url";

/**
 * Holt den Manifest-Entwurf, den die Website aus ihrer eigenen CSS
 * erzeugt (siehe `apps/site/src/app/api/template/draft`).
 *
 * Wie bei `/api/template`: die Verwaltung fragt dort, wo das Template
 * lebt, und behandelt "geht gerade nicht" als Antwort statt als Fehler –
 * ein Entwurf lässt sich nur erzeugen, wo die Website aus ihren Quellen
 * läuft.
 */
export async function GET(request: Request) {
  const base = await resolveSiteBaseUrl(request);
  try {
    const res = await fetch(`${base}/api/template/draft`, {
      cache: "no-store",
    });
    if (!res.ok) {
      return Response.json({
        draft: null,
        reason: `Die Webseite antwortete mit ${res.status}.`,
      });
    }
    return Response.json(await res.json());
  } catch {
    return Response.json({
      draft: null,
      reason: "Die Webseite ist nicht erreichbar.",
    });
  }
}
