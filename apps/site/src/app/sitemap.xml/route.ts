import { REVALIDATE_SECONDS } from "@/lib/api";

const API_URL = process.env.API_URL ?? "http://localhost:3001/v1";

export const revalidate = 60;

/** Reicht die Sitemap der Content-Delivery-API durch, statt die Liste hier
 * ein zweites Mal aus einzelnen Endpunkten zusammenzubauen: die API kennt
 * bereits alle veröffentlichten Inhalte, respektiert `robotsIndex` und
 * liefert ohne gepflegte `publicBaseUrl` bewusst eine leere Sitemap statt
 * erfundener URLs (siehe PublicContentService.getSitemapEntries()). */
export async function GET() {
  const res = await fetch(`${API_URL}/public/sitemap.xml`, {
    next: { revalidate: REVALIDATE_SECONDS },
  });
  if (!res.ok) {
    return new Response("Sitemap derzeit nicht verfügbar.", { status: 502 });
  }
  return new Response(await res.text(), {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "s-maxage=60, stale-while-revalidate",
    },
  });
}
