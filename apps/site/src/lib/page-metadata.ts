import type { Metadata } from "next";
import { resolveImageSrc } from "@pivot/blocks";
import { absoluteUrl, type PublicContent, type SiteSettings } from "./api";

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

/** Metadaten einer Inhaltsseite – identisch für die Startseite (`/`) und
 * für freie Seiten (`/{slug}`); der kanonische Pfad kommt in beiden
 * Fällen als `content.path` vom Server. */
export function contentMetadata(
  content: PublicContent,
  site: SiteSettings,
): Metadata {
  const title = content.seoTitle?.trim() || content.title;
  const description =
    content.seoDescription?.trim() ||
    content.excerpt?.trim() ||
    site.defaultSeoDescription?.trim() ||
    undefined;
  const image = content.ogImageUrl
    ? resolveImageSrc(content.ogImageUrl)
    : site.defaultOgImageUrl
      ? resolveImageSrc(site.defaultOgImageUrl)
      : undefined;
  const card = twitterCard(content.twitterCard);

  return {
    title,
    description,
    alternates: {
      // Ein im Editor gepflegter Wert gewinnt; sonst wird die kanonische
      // URL aus publicBaseUrl plus dem Pfad des Servers gebildet
      // (Frontend-Plan: "Content.canonicalUrl bekommt einen echten
      // Default").
      canonical:
        content.canonicalUrl?.trim() ||
        absoluteUrl(site.publicBaseUrl, content.path),
    },
    robots: { index: content.robotsIndex, follow: content.robotsFollow },
    openGraph: {
      type: "article",
      title: content.ogTitle?.trim() || title,
      description: content.ogDescription?.trim() || description,
      images: image ? [image] : undefined,
    },
    twitter: card ? { card } : undefined,
  };
}
