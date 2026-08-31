import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ContentArticle } from "@/components/content-article";
import { getBlockContext, getPage, getSiteSettings } from "@/lib/api";
import { contentMetadata } from "@/lib/page-metadata";

export const revalidate = 60;

type PageProps = { params: Promise<{ slug: string }> };

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const [page, site] = await Promise.all([getPage(slug), getSiteSettings()]);
  if (!page) return {};
  return contentMetadata(page, site);
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
    <ContentArticle
      content={page}
      moduleTypes={moduleTypes}
      globalModules={globalModules}
    />
  );
}
