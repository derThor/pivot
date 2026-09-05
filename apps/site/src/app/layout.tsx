import type { CSSProperties, ReactNode } from "react";
import type { Metadata } from "next";
import {
  BUILTIN_TEMPLATE_KEY,
  resolveImageSrc,
  resolveTemplateSettings,
  templateCssVars,
  templateSettingsFor,
} from "@pivot/blocks";
import {
  getActiveFrontendTemplate,
  getAllNavigations,
  getBlockContext,
  getSiteSettings,
  getTemplateRegions,
  regionBlocks,
} from "@/lib/api";
import { fontVariables } from "@/template/fonts";
import { templateManifest } from "@/template/manifest";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { TemplateRegion } from "@/components/template-region";
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
  // Bereiche des Templates (Stufe 2, 2026-09-05): sind Bausteine
  // hinterlegt, ersetzen sie die eingebaute Fassung von Kopf- bzw.
  // Fußbereich. Leer = eingebaute Fassung, damit eine bestehende Website
  // durch das Einführen der Mechanik unverändert bleibt.
  const [site, regions, blockContext, navigations, activeTemplate] =
    await Promise.all([
      getSiteSettings(),
      getTemplateRegions(),
      getBlockContext(),
      // Für den Menü-Baustein: er speichert nur eine Id, aufgelöst wird hier.
      getAllNavigations(),
      // Ein hochgeladenes, aktives Template (Einstellungen → Frontend →
      // Templates). Es bringt Manifest und CSS mit und sticht damit beides
      // aus diesem Projekt – ohne Deploy, weil CSS keinen Build braucht.
      getActiveFrontendTemplate(),
    ]);
  const headerBlocks = regionBlocks(regions.header);
  const footerBlocks = regionBlocks(regions.footer);
  // Die Gestaltungswerte dieses Templates: was das Manifest deklariert,
  // gemischt mit dem, was in den Einstellungen gespeichert ist (2026-09-05).
  // Alles mit `cssVar` landet als CSS-Variable auf <html> – das Template
  // benutzt seine Variablen wie bisher und merkt vom Mechanismus nichts.
  // Ein in der Verwaltung hochgeladenes Manifest sticht die Datei dieses
  // Projekts (2026-09-05); ohne eines gilt die Datei. Die Datei bleibt
  // dabei die Wahrheit darüber, was WIRKT – ein hochgeladenes Feld auf
  // eine unbenutzte CSS-Variable bleibt folgenlos.
  // Rangfolge: aktives hochgeladenes Template → in den Einstellungen
  // hinterlegtes Manifest → die Datei dieses Projekts.
  const manifest =
    activeTemplate?.manifest ?? site.templateManifest ?? templateManifest;
  // Werte liegen JE TEMPLATE (siehe templateSettingsFor): sonst gewinnen
  // die gespeicherten Farben des vorigen Templates über die Vorgaben des
  // neuen, sobald beide denselben Schlüssel benutzen.
  const templateValues = resolveTemplateSettings(
    manifest,
    templateSettingsFor(
      site.templateSettings,
      activeTemplate?.key ?? BUILTIN_TEMPLATE_KEY,
    ),
  );
  // Nur Werte aus dem Manifest DIESES Templates. Die Akzentfarbe unter
  // Einstellungen → Darstellung Backend wirkt bewusst NICHT mehr hierher
  // (Nutzervorgabe, 2026-09-05: "alles aus Darstellung Backend darf sich
  // nur aufs backend auswirken") – die Website hat ihre eigene, im
  // Manifest deklarierte Akzentfarbe.
  const themeStyle = templateCssVars(manifest, templateValues) as CSSProperties;

  return (
    <html
      lang="de"
      style={themeStyle}
      // Welche Schriften das sind, entscheidet das Template dieser
      // Installation (src/template/fonts.ts) – diese Datei hier bleibt
      // projektübergreifend gleich.
      className={fontVariables}
    >
      {/* Das CSS des aktiven Templates. Bewusst inline und NICHT als
          eigene Datei: es ist wenige Kilobyte groß, muss zum gerade
          aktiven Stand passen und darf beim Umschalten keinen Moment
          veraltet ausgeliefert werden. Es steht NACH dem Stylesheet der
          App, gewinnt also bei gleicher Spezifität – gestylt wird gegen
          die Ankerklassen (siehe STYLE_HOOKS in @pivot/blocks).

          Geprüft wurde es beim Import (kein @import, keine externen
          Adressen, siehe assertSafeCss in der API), nicht hier. */}
      {activeTemplate?.css && (
        <style
          data-template={activeTemplate.key}
          dangerouslySetInnerHTML={{ __html: activeTemplate.css }}
        />
      )}
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
        >
          {/* Sind im Bereich "Kopfbereich" Bausteine hinterlegt, füllen sie
              den Balken – sonst bleibt die eingebaute Fassung (Logo, Menü,
              Handlungsaufrufe) stehen. */}
          {headerBlocks.length > 0 ? (
            <TemplateRegion
              data={regions.header!.data}
              moduleTypes={blockContext.moduleTypes}
              globalModules={blockContext.globalModules}
              navigations={navigations}
              siteTitle={site.siteTitle}
            />
          ) : null}
        </SiteHeader>

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
        <main className="pv-main mx-auto w-full max-w-[var(--content-width,1180px)] flex-1 px-6 pb-14 sm:px-8">
          {children}
        </main>

        {/* Fußbereich: gepflegte Bausteine schlagen die eingebaute
            Fassung. Anders als beim Kopfbereich braucht es hier keinen
            Rahmen mit Verhalten – nur die dunkle Fläche und die Bahn. */}
        {footerBlocks.length > 0 ? (
          <footer className="pv-footer bg-surface-dark text-surface-dark-foreground">
            <div className="mx-auto w-full max-w-[var(--content-width,1180px)] px-6 py-14 sm:px-8">
              <TemplateRegion
                data={regions.footer!.data}
                moduleTypes={blockContext.moduleTypes}
                globalModules={blockContext.globalModules}
                navigations={navigations}
                siteTitle={site.siteTitle}
              />
            </div>
          </footer>
        ) : (
          <SiteFooter site={site} legalLinks={site.legalLinks} />
        )}
      </body>
    </html>
  );
}
