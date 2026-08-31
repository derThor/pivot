import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ContentArticle } from "@/components/content-article";
import { getBlockContext, getHome, getSiteSettings } from "@/lib/api";
import { contentMetadata } from "@/lib/page-metadata";

export const revalidate = 60;

export async function generateMetadata(): Promise<Metadata> {
  const [home, site] = await Promise.all([getHome(), getSiteSettings()]);
  if (!home) return {};
  return contentMetadata(home, site);
}

/** Startseite: der Inhalt des Menüpunkts, der im Backend unter
 * Navigation als Startseite markiert ist (Nutzervorgabe, 2026-08-31 –
 * gesetzt am Menüpunkt, nicht in den Einstellungen). Ist keiner markiert
 * oder ist dessen Seite nicht veröffentlicht, liefert die API 404 und
 * `/` bleibt bewusst eine 404-Seite statt irgendeine Seite zu raten. */
export default async function HomePage() {
  const home = await getHome();
  if (!home) notFound();

  const { moduleTypes, globalModules } = await getBlockContext();

  return (
    <ContentArticle
      content={home}
      moduleTypes={moduleTypes}
      globalModules={globalModules}
    />
  );
}
