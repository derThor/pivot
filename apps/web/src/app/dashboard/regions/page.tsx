import { RegionsExplorer } from "@/components/regions-explorer";
import {
  getGlobalModules,
  getModuleTypes,
  getTemplateManifest,
  getTemplateRegion,
} from "@/lib/api-server";

/**
 * Inhalte → Bereiche: Kopfbereich, Fußbereich und was das Template sonst
 * deklariert, gefüllt mit Bausteinen aus demselben Designer wie eine Seite
 * (Stufe 2 der Template-Mechanik, siehe
 * knowledge-base/frontend/template-manifest.md).
 *
 * WELCHE Bereiche es gibt, steht im Manifest des Frontends – diese Seite
 * hat keine eigene Liste. Läuft die Website nicht, kann sie deshalb auch
 * nichts anzeigen; das erklärt der Explorer dann.
 */
export default async function RegionsPage({
  searchParams,
}: {
  searchParams: Promise<{ region?: string }>;
}) {
  const { region: regionParam } = await searchParams;
  const manifest = await getTemplateManifest();
  const regions = manifest?.regions ?? [];
  const selectedKey = regionParam ?? regions[0]?.key ?? null;

  const [moduleTypes, globalModules, selected] = await Promise.all([
    getModuleTypes(),
    getGlobalModules(),
    selectedKey ? getTemplateRegion(selectedKey) : Promise.resolve(null),
  ]);

  return (
    <RegionsExplorer
      templateName={manifest?.name ?? null}
      regions={regions}
      selectedKey={selectedKey}
      initialData={selected?.data ?? { blocks: [] }}
      moduleTypes={moduleTypes ?? []}
      globalModules={globalModules ?? []}
    />
  );
}
