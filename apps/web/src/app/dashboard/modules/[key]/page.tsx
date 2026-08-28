import { notFound } from "next/navigation";
import { PageContent } from "@/components/page-content";
import { ModuleDetailView } from "@/components/module-detail-view";
import {
  getMandanten,
  getMandantModuleCatalog,
  getModuleSettings,
  getPublicSettings,
} from "@/lib/api-server";

export default async function ModuleDetailPage({
  params,
}: {
  params: Promise<{ key: string }>;
}) {
  const { key } = await params;
  const [catalog, mandanten, publicSettings, moduleSettings] =
    await Promise.all([
      getMandantModuleCatalog(),
      // Für "Auf Websites aktiv" – reicht bei der aktuellen/realistischen
      // Mandantenzahl, siehe gleicher Kommentar in dashboard/modules/page.tsx.
      getMandanten({ page: 1, pageSize: 100 }),
      getPublicSettings(),
      // Masters EIGENE Freischaltung dieses Moduls (Nutzervorgabe,
      // 2026-08-28: "das soll direkt in dem Modul unter Module und
      // Datenschutz eingestellt werden") – `null` auf einer Client-
      // Installation (`MasterOnlyGuard`), dann zeigt die Ansicht keine
      // Schalter an.
      getModuleSettings(),
    ]);
  const moduleEntry = catalog?.find((entry) => entry.key === key);
  if (!moduleEntry) {
    notFound();
  }

  const activeMandanten = (mandanten?.items ?? []).filter((mandant) =>
    mandant.modules.some((m) => m.moduleKey === key && m.enabled),
  );
  const settingsEntry =
    moduleSettings?.find((entry) => entry.moduleKey === key) ?? null;

  return (
    <PageContent plain>
      <ModuleDetailView
        module={moduleEntry}
        activeMandanten={activeMandanten}
        appVersion={publicSettings?.appVersion ?? null}
        settings={settingsEntry}
      />
    </PageContent>
  );
}
