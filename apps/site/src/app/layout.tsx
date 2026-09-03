import type { CSSProperties, ReactNode } from "react";
import type { Metadata } from "next";
import { resolveImageSrc } from "@pivot/blocks";
import { getSiteSettings } from "@/lib/api";
import { fontVariables } from "@/template/fonts";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import "./globals.css";

// Siehe REVALIDATE_SECONDS in lib/api.ts – hier bewusst als Literal, weil
// Next.js diesen Segment-Wert statisch auswerten muss.
export const revalidate = 60;

export async function generateMetadata(): Promise<Metadata> {
  const site = await getSiteSettings();
  const title = site.siteTitle?.trim();
  const description =
    site.defaultSeoDescription?.trim() || site.siteTagline?.trim() || undefined;
  const ogImage = site.defaultOgImageUrl
    ? resolveImageSrc(site.defaultOgImageUrl)
    : undefined;

  return {
    // Ohne gepflegten Website-Titel (Einstellungen → Frontend) bleibt das
    // Feld leer, statt einen Namen zu erfinden.
    title: title ? { default: title, template: `%s – ${title}` } : undefined,
    description,
    // metadataBase macht relative canonical-/OG-URLs in den Unterseiten
    // absolut; ohne publicBaseUrl gibt es keine gültige Basis.
    metadataBase: site.publicBaseUrl ? new URL(site.publicBaseUrl) : undefined,
    icons: site.faviconUrl
      ? { icon: resolveImageSrc(site.faviconUrl) }
      : undefined,
    openGraph: {
      type: "website",
      title,
      description,
      images: ogImage ? [ogImage] : undefined,
    },
  };
}

export default async function RootLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  const site = await getSiteSettings();
  // Akzentfarbe der Installation überschreibt das Theme-Token zur Laufzeit;
  // alle `*-accent`-Utilities lesen dieselbe Variable.
  const themeStyle = site.accentColor
    ? ({ "--color-accent": site.accentColor } as CSSProperties)
    : undefined;

  return (
    <html
      lang="de"
      style={themeStyle}
      // Welche Schriften das sind, entscheidet das Template dieser
      // Installation (src/template/fonts.ts) – diese Datei hier bleibt
      // projektübergreifend gleich.
      className={fontVariables}
    >
      <body className="flex min-h-screen flex-col">
        <SiteHeader
          siteTitle={site.siteTitle}
          navigation={site.mainNavigation}
        />

        {/* Der Inhalt kommt vollständig aus dem Seiten-Designer
            (Nutzervorgabe, 2026-09-02: "alle Inhalte sollen über den
            Designer unter Seiten kommen"). Die Hülle gibt dafür dieselbe
            Bahn vor wie Header und Footer (1180px), damit alles auf einer
            Flucht steht.

            Randlose Abschnitte über die volle Fensterbreite – im Entwurf
            der Hero und das Branchen-Band – kann heute kein Baustein: die
            Breite liegt hier und nicht im Baustein. Das aufzubrechen wäre
            ein eigener Schritt am Designer, kein Nebeneffekt der Hülle. */}
        {/* `overflow-x-clip` ist die Voraussetzung für randlose Blöcke:
            die brechen mit `100vw` aus dieser Bahn aus, und `100vw`
            schließt die Bildlaufleiste mit ein. Ohne das Abschneiden
            entstünde eine waagerechte Bildlaufleiste (siehe
            blockLayoutClasses in @pivot/blocks). */}
        <main className="mx-auto w-full max-w-[var(--content-width,1180px)] flex-1 overflow-x-clip px-6 py-14 sm:px-8">
          {children}
        </main>

        <SiteFooter site={site} legalLinks={site.legalLinks} />
      </body>
    </html>
  );
}
