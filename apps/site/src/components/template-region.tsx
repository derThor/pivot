import { cn, type GlobalModule } from "@pivot/blocks";
import { ContentBlocks } from "@/components/content-blocks";
import type { ModuleType, SiteNavigation } from "@/lib/api";

/**
 * Ein Template-Bereich (Kopfbereich, Fußbereich, …), gefüllt mit den
 * Bausteinen aus dem Designer – Stufe 2 der Template-Mechanik
 * (Nutzervorgabe, 2026-09-05: *"können wir das bausteinmäßig machen …
 * also sowas wie header content und footer"*).
 *
 * Gerendert wird mit demselben `ContentBlocks` wie eine Seite: ein Bereich
 * ist inhaltlich nichts anderes. Der RAHMEN drumherum bleibt dagegen Code
 * (siehe `SiteHeader`) – Kleben, Weichzeichnen, die Höhenmessung und
 * später das Burger-Menü sind Verhalten, und Bausteine haben keins.
 *
 * `data` hat die Form von `Content.data`, also `{ blocks: [...] }`; der
 * Aufrufer prüft vorher mit `regionBlocks()`, ob überhaupt etwas drin ist.
 */
export function TemplateRegion({
  data,
  moduleTypes,
  globalModules,
  navigations,
  siteTitle,
  className,
}: {
  data: Record<string, unknown>;
  moduleTypes: ModuleType[];
  globalModules: GlobalModule[];
  /** Für den Menü- und den Logo-Baustein, siehe ContentBlocks. */
  navigations?: Record<string, SiteNavigation>;
  siteTitle?: string | null;
  className?: string;
}) {
  return (
    <div className={cn("pv-region", className)}>
      <ContentBlocks
        data={data}
        moduleTypes={moduleTypes}
        globalModules={globalModules}
        navigations={navigations}
        siteTitle={siteTitle}
      />
    </div>
  );
}
