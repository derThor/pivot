import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ContentArticle } from "@/components/content-article";
import { PreviewNotice } from "@/components/preview-notice";
import {
  getBlockContext,
  getCategoryPost,
  getPreviewContent,
  getSiteSettings,
} from "@/lib/api";
import { contentMetadata } from "@/lib/page-metadata";

export const revalidate = 60;

type PageProps = {
  params: Promise<{ slug: string; postSlug: string }>;
  searchParams: Promise<{ preview?: string }>;
};

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug, postSlug } = await params;
  const [post, site] = await Promise.all([
    getCategoryPost(slug, postSlug),
    getSiteSettings(),
  ]);
  if (!post) return {};
  return contentMetadata(post, site);
}

/** Beitrag innerhalb einer Kategorie – URL-Schema
 * `/{kategorie-slug}/{content-slug}` (Schritt 4 des Frontend-Plans,
 * gebaut 2026-09-02). Bis dahin waren alle Inhalte MIT Kategorie auf der
 * öffentlichen Website nicht erreichbar: es gab schlicht keine Route mit
 * zwei Segmenten, obwohl `buildContentPath()` im Backend längst solche
 * Pfade auswies.
 *
 * Das Backend prüft dabei ausdrücklich die Kategorie-Zuordnung mit – ein
 * Beitrag ist also nicht unter jeder beliebigen Kategorie-URL erreichbar
 * (siehe `PublicContentService.getCategoryPost()`). */
export default async function CategoryPostPage({
  params,
  searchParams,
}: PageProps) {
  const { slug, postSlug } = await params;
  const { preview } = await searchParams;

  // Vorschau-Token schlägt die normale Auflösung – siehe gleichlautender
  // Zweig in der Elternroute `[slug]/page.tsx`.
  const post = preview
    ? await getPreviewContent(preview)
    : await getCategoryPost(slug, postSlug);
  if (!post) notFound();

  const { moduleTypes, globalModules } = await getBlockContext();

  return (
    <>
      {preview && <PreviewNotice />}
      <ContentArticle
        content={post}
        // In der Vorschau leer: der Token kennt weder Menüpunkt noch
        // Seitenkontext (siehe getPreviewContent()).
        spacing={post.spacing}
        moduleTypes={moduleTypes}
        globalModules={globalModules}
      />
    </>
  );
}
