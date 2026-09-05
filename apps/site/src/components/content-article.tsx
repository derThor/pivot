import { cn, type GlobalModule } from "@pivot/blocks";
import { ContentBlocks } from "@/components/content-blocks";
import type { ModuleType, PageSpacing, PublicContent } from "@/lib/api";
import { pageSpacingStyle } from "@/lib/page-spacing";

/** Gemeinsame Darstellung einer Inhaltsseite – genutzt von der Startseite
 * (`/`) und von freien Seiten (`/{slug}`), damit beide identisch aussehen
 * und nur über die Datenquelle unterschieden werden. */
export function ContentArticle({
  content,
  moduleTypes,
  globalModules,
  spacing,
}: {
  content: PublicContent;
  moduleTypes: ModuleType[];
  globalModules: GlobalModule[];
  /** Am Menüpunkt gesetzter Abstand oben/unten (Nutzervorgabe,
   * 2026-09-03). Fehlt bei der Vorschau, die keinen Menüpunkt kennt. */
  spacing?: PageSpacing | null;
}) {
  // Der Abstand kommt über CSS-Variablen, damit Mobil und Desktop
  // getrennt greifen können (siehe pageSpacingStyle()). Die Klasse nur
  // setzen, wenn wirklich etwas eingestellt ist – sonst stünde eine Regel
  // im Weg, die es vorher nicht gab.
  const spacingStyle = pageSpacingStyle(spacing);
  return (
    <article
      className={cn(
        "pv-article flex flex-col gap-8",
        spacingStyle && "page-spacing",
      )}
      style={spacingStyle}
    >
      {/* "Titel ausblenden" (Nutzervorgabe, 2026-09-03): gedacht für
          Seiten, die mit einem randlosen Aufmacher beginnen und ihren
          Titel schon im Bild tragen – dort stünde die Überschrift doppelt.
          Der Anreißtext hängt mit daran: er ist die Unterzeile zur
          Überschrift und stünde ohne sie zusammenhanglos da.

          Der Titel selbst bleibt gesetzt und wird weiter gebraucht – für
          den Browser-Tab und die Suchmaschinen (siehe generateMetadata der
          Seite), nur eben nicht als sichtbare H1. */}
      {!content.hideTitle && (
        <header className="flex flex-col gap-3">
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            {content.title}
          </h1>
          {content.excerpt && (
            <p className="text-lg text-muted-foreground">{content.excerpt}</p>
          )}
        </header>
      )}

      <ContentBlocks
        data={content.data}
        moduleTypes={moduleTypes}
        globalModules={globalModules}
      />
    </article>
  );
}
