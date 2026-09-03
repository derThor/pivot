import { REVALIDATE_SECONDS } from "@/lib/api";

const API_URL = process.env.API_URL ?? "http://localhost:3001/v1";

export const revalidate = 60;

/**
 * RSS-Feed einer Kategorie unter `/{kategorie}/feed.xml` (Schritt 5 des
 * Frontend-Plans). Reicht den Feed der API durch, statt ihn hier ein
 * zweites Mal zu bauen – dieselbe Entscheidung wie bei der Sitemap: die
 * API kennt die veröffentlichten Inhalte bereits, eine zweite
 * Sammel-Logik wäre eine Drift-Quelle.
 *
 * Antwortet mit 404, wenn es die Kategorie nicht gibt oder ihr RSS-Feed
 * abgeschaltet ist (`Category.rssEnabled`) – ein Feed-Reader soll dann
 * nichts abonnieren können.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const res = await fetch(
    `${API_URL}/public/categories/${encodeURIComponent(slug)}/feed.xml`,
    { next: { revalidate: REVALIDATE_SECONDS } },
  );
  if (!res.ok) {
    return new Response("Kein RSS-Feed für diese Kategorie.", { status: 404 });
  }
  return new Response(await res.text(), {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": `s-maxage=${REVALIDATE_SECONDS}, stale-while-revalidate`,
    },
  });
}
