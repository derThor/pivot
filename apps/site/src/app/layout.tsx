import type { CSSProperties, ReactNode } from "react";
import type { Metadata } from "next";
import {
  resolveImageSrc,
  resolveTemplateSettings,
  templateCssVars,
} from "@pivot/blocks";
import { getSiteSettings } from "@/lib/api";
import { fontVariables } from "@/template/fonts";
import { templateManifest } from "@/template/manifest";
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
  // Die Gestaltungswerte dieses Templates: was das Manifest deklariert,
  // gemischt mit dem, was in den Einstellungen gespeichert ist (2026-09-05).
  // Alles mit `cssVar` landet als CSS-Variable auf <html> – das Template
  // benutzt seine Variablen wie bisher und merkt vom Mechanismus nichts.
  const templateValues = resolveTemplateSettings(
    templateManifest,
    site.templateSettings,
  );
  const themeStyle = {
    ...templateCssVars(templateManifest, templateValues),
    // Die Akzentfarbe bleibt bewusst eine eigene Einstellung
    // (`AppSettings.accentColor`, auch in der Verwaltung sichtbar) und
    // steht NICHT im Manifest: sie gäbe es sonst zweimal. Sie kommt
    // zuletzt und sticht damit einen gleichnamigen Template-Wert.
    ...(site.accentColor ? { "--color-accent": site.accentColor } : {}),
  } as CSSProperties;

  return (
    <html
      lang="de"
      style={themeStyle}
      // Welche Schriften das sind, entscheidet das Template dieser
      // Installation (src/template/fonts.ts) – diese Datei hier bleibt
      // projektübergreifend gleich.
      className={fontVariables}
    >
      {/* `overflow-x-clip` gehört hierher und nicht auf die Inhaltsbahn:
          randlose Blöcke sind `100vw` breit, und `100vw` schließt die
          senkrechte Bildlaufleiste mit ein – sie ragen also um deren
          Breite über den sichtbaren Bereich hinaus. Ohne das Abschneiden
          entstünde dadurch eine waagerechte Bildlaufleiste. */}
      <body className="flex min-h-screen flex-col overflow-x-clip">
        <SiteHeader
          siteTitle={site.siteTitle}
          navigation={site.mainNavigation}
          // Werte aus dem Manifest dieses Templates – ohne `cssVar` liest
          // das Template sie selbst aus, statt sie als CSS-Variable zu
          // bekommen (siehe template-manifest.ts).
          sticky={templateValues.headerSticky !== false}
          style={templateValues.headerStyle === "solid" ? "solid" : "blur"}
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
        {/* Kein Abstand nach OBEN (Nutzervorgabe, 2026-09-03: "Abstand auf
            das erste Element seiner Seite nach oben soll nicht sein") –
            ein Aufmacher soll bündig unter dem Kopfbereich sitzen. Wer an
            einer Stelle doch Luft braucht, setzt sie am Baustein selbst
            (Abstände-Dialog im Designer).

            Die Bahn selbst darf NICHT abschneiden – sonst wäre sie genau
            die Grenze, die randlose Blöcke überwinden sollen (Fehlerbild
            2026-09-03: der Block war 100vw breit, wurde aber auf
            Bahnbreite beschnitten). Abgeschnitten wird am <body>, der
            über die volle Fensterbreite geht. */}
        <main className="mx-auto w-full max-w-[var(--content-width,1180px)] flex-1 px-6 pb-14 sm:px-8">
          {children}
        </main>

        <SiteFooter site={site} legalLinks={site.legalLinks} />
      </body>
    </html>
  );
}
