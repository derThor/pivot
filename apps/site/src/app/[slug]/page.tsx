import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { resolveImageSrc } from "@pivot/blocks";
import { ContentBlocks } from "@/components/content-blocks";
import {
  absoluteUrl,
  contentPath,
  getBlockContext,
  getPage,
  getSiteSettings,
  type PublicContent,
  type SiteSettings,
} from "@/lib/api";

export const revalidate = 60;

type PageProps = { params: Promise<{ slug: string }> };

/** `twitterCard` ist im Datenmodell ein freier String (Default "none").
 * Übernommen werden nur die beiden Kartentypen, die ohne zusätzliche
 * Pflichtfelder auskommen – "app"/"player" verlangen eigene Angaben
 * (App-IDs bzw. Player-URL), die das Datenmodell gar nicht kennt. */
function twitterCard(
  value: string | null,
): "summary" | "summary_large_image" | undefined {
  return value === "summary" || value === "summary_large_image"
    ? value
    : undefined;
}

function pageMetadata(page: PublicContent, site: SiteSettings): Metadata {
  const title = page.seoTitle?.trim() || page.title;
  const description =
    page.seoDescription?.trim() ||
    page.excerpt?.trim() ||
    site.defaultSeoDescription?.trim() ||
    undefined;
  const image = page.ogImageUrl
    ? resolveImageSrc(page.ogImageUrl)
    : site.defaultOgImageUrl
      ? resolveImageSrc(site.defaultOgImageUrl)
      : undefined;

  const card = twitterCard(page.twitterCard);

  return {
    title,
    description,
    alternates: {
      // Ein im Editor gepflegter Wert gewinnt; sonst wird die kanonische
      // URL aus publicBaseUrl + URL-Schema berechnet (Frontend-Plan:
      // "Content.canonicalUrl bekommt einen echten Default").
      canonical:
        page.canonicalUrl?.trim() ||
        absoluteUrl(site.publicBaseUrl, contentPath(page)),
    },
    robots: { index: page.robotsIndex, follow: page.robotsFollow },
    openGraph: {
      type: "article",
      title: page.ogTitle?.trim() || title,
      description: page.ogDescription?.trim() || description,
      images: image ? [image] : undefined,
    },
    twitter: card ? { card } : undefined,
  };
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const [page, site] = await Promise.all([getPage(slug), getSiteSettings()]);
  if (!page) return {};
  return pageMetadata(page, site);
}

/** Freie Seite (Content ohne Kategorie) – URL-Schema `/{content-slug}`.
 * Beiträge liegen unter `/{kategorie-slug}/{content-slug}` und kommen in
 * Schritt 4 des Frontend-Plans dazu. */
export default async function FreePage({ params }: PageProps) {
  const { slug } = await params;
  const page = await getPage(slug);
  if (!page) notFound();

  const { moduleTypes, globalModules } = await getBlockContext();

  return (
    <article className="flex flex-col gap-8">
      <header className="flex flex-col gap-3">
        <h1 className="text-4xl font-semibold tracking-tight">{page.title}</h1>
        {page.excerpt && (
          <p className="text-lg text-muted-foreground">{page.excerpt}</p>
        )}
      </header>

      <ContentBlocks
        data={page.data}
        moduleTypes={moduleTypes}
        globalModules={globalModules}
      />
    </article>
  );
}
