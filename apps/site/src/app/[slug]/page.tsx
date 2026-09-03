import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CategoryArchive } from "@/components/category-archive";
import { ContentArticle } from "@/components/content-article";
import { PreviewNotice } from "@/components/preview-notice";
import {
  getBlockContext,
  getCategoryArchive,
  getPage,
  getPreviewContent,
  getSiteSettings,
} from "@/lib/api";
import { contentMetadata } from "@/lib/page-metadata";

export const revalidate = 60;

type PageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ page?: string; preview?: string }>;
};

function pageNumber(value: string | undefined): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const [page, site] = await Promise.all([getPage(slug), getSiteSettings()]);
  if (page) return contentMetadata(page, site);

  // Kein freier Inhalt unter diesem Slug – dann ist es womöglich eine
  // Kategorie-Archivseite.
  const archive = await getCategoryArchive(slug, 1);
  if (!archive) return {};
  return {
    title: archive.category.name,
    description: archive.category.description ?? undefined,
    // Feed-Reader und Browser finden den RSS-Feed über diesen <link> im
    // <head> – der sichtbare Link im Archiv ist nur die Zugabe für
    // Menschen (Schritt 5 des Frontend-Plans). Nur wenn die Kategorie
    // ihren Feed überhaupt anbietet, sonst zeigte er ins Leere (die
    // Feed-Route antwortet dann mit 404).
    ...(archive.category.rssEnabled && {
      alternates: {
        types: {
          "application/rss+xml": [
            { url: `/${slug}/feed.xml`, title: archive.category.name },
          ],
        },
      },
    }),
  };
}

/** Ein Slug auf oberster Ebene ist entweder eine **freie Seite**
 * (Content ohne Kategorie, `/{content-slug}`) oder das **Archiv einer
 * Kategorie** (`/{kategorie-slug}`, seit 2026-09-02, Schritt 4 des
 * Frontend-Plans). Next.js erlaubt auf derselben Ebene nur ein dynamisches
 * Segment, deshalb entscheidet diese Route zur Laufzeit – Inhalt zuerst,
 * Kategorie als Zweitversuch.
 *
 * Kollidieren Slugs (eine freie Seite und eine Kategorie heißen gleich),
 * gewinnt bewusst die Seite: sie ist das speziellere Ziel und war zuerst
 * erreichbar. */
export default async function SlugPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const { page: pageParam, preview } = await searchParams;

  // Vorschau über einen Token aus dem Backend (siehe `getPreviewContent`):
  // zeigt auch unveröffentlichte Stände und geht deshalb vor der normalen
  // Slug-Auflösung. Der Slug in der URL ist dabei nur Kosmetik – maßgeblich
  // ist, worauf der Token zeigt.
  if (preview) {
    const previewContent = await getPreviewContent(preview);
    if (!previewContent) notFound();
    const { moduleTypes, globalModules } = await getBlockContext();
    return (
      <>
        <PreviewNotice />
        <ContentArticle
          content={previewContent}
          moduleTypes={moduleTypes}
          globalModules={globalModules}
        />
      </>
    );
  }

  const [page, site] = await Promise.all([getPage(slug), getSiteSettings()]);

  if (page) {
    const { moduleTypes, globalModules } = await getBlockContext();
    return (
      <ContentArticle
        content={page}
        spacing={page.spacing}
        moduleTypes={moduleTypes}
        globalModules={globalModules}
      />
    );
  }

  const archive = await getCategoryArchive(slug, pageNumber(pageParam));
  if (!archive) notFound();
  // Die Blog-Darstellung schreibt die Beitraege aus und braucht dafuer
  // dieselben Bausteine wie eine normale Seite.
  const { moduleTypes, globalModules } = await getBlockContext();

  return (
    <CategoryArchive
      archive={archive}
      site={site}
      moduleTypes={moduleTypes}
      globalModules={globalModules}
    />
  );
}
