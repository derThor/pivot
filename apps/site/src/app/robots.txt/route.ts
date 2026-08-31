import { getSiteSettings, REVALIDATE_SECONDS } from "@/lib/api";

export const revalidate = 60;

/** Backend und API liegen unter Pfaden derselben Domain (siehe
 * knowledge-base/platform/deployment.md) – beide gehören nicht in den
 * Index. Die Sitemap wird nur verlinkt, wenn eine Basis-URL gepflegt ist;
 * ohne sie gäbe es keine gültige absolute URL (gleiches Prinzip wie in der
 * Sitemap selbst). */
export async function GET() {
  const site = await getSiteSettings();
  const base = site.publicBaseUrl?.replace(/\/$/, "");
  const lines = [
    "User-agent: *",
    "Disallow: /admin",
    "Disallow: /api",
    ...(base ? ["", `Sitemap: ${base}/sitemap.xml`] : []),
    "",
  ];
  return new Response(lines.join("\n"), {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": `s-maxage=${REVALIDATE_SECONDS}, stale-while-revalidate`,
    },
  });
}
