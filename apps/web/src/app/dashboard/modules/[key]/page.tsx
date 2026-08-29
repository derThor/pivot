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
  const [catalog, mandanten, moduleSettings, publicSettings] =
    await Promise.all([
      getMandantModuleCatalog(),
      // Für "Bei Mandanten" (ALLE Mandanten, nicht nur die mit gebuchtem
      // Modul – zeigt auch, wer es noch nicht hat) – reicht bei der
      // aktuellen/realistischen Mandantenzahl, siehe gleicher Kommentar in
      // dashboard/modules/page.tsx.
      getMandanten({ page: 1, pageSize: 100 }),
      // Für "Bei neuen Mandanten vorinstallieren" (Korrektur 2026-08-29:
      // hierher verschoben, siehe module-auto-install-toggle.tsx).
      getModuleSettings(),
      getPublicSettings(),
    ]);
  const moduleEntry = catalog?.find((entry) => entry.key === key);
  if (!moduleEntry) {
    notFound();
  }

  const autoInstallForNewMandants =
    moduleSettings?.find((entry) => entry.moduleKey === key)
      ?.autoInstallForNewMandants ?? false;

  return (
    <PageContent plain>
      <ModuleDetailView
        module={moduleEntry}
        mandanten={mandanten?.items ?? []}
        appVersion={publicSettings?.appVersion ?? null}
        autoInstallForNewMandants={autoInstallForNewMandants}
      />
    </PageContent>
  );
}
