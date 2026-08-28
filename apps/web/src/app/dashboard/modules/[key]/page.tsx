import { notFound } from "next/navigation";
import { PageContent } from "@/components/page-content";
import { ModuleDetailView } from "@/components/module-detail-view";
import {
  getMandanten,
  getMandantModuleCatalog,
  getPublicSettings,
} from "@/lib/api-server";

export default async function ModuleDetailPage({
  params,
}: {
  params: Promise<{ key: string }>;
}) {
  const { key } = await params;
  const [catalog, mandanten, publicSettings] = await Promise.all([
    getMandantModuleCatalog(),
    // Für "Bei Mandanten" (ALLE Mandanten, nicht nur die mit gebuchtem
    // Modul – zeigt auch, wer es noch nicht hat) – reicht bei der
    // aktuellen/realistischen Mandantenzahl, siehe gleicher Kommentar in
    // dashboard/modules/page.tsx.
    getMandanten({ page: 1, pageSize: 100 }),
    getPublicSettings(),
  ]);
  const moduleEntry = catalog?.find((entry) => entry.key === key);
  if (!moduleEntry) {
    notFound();
  }

  return (
    <PageContent plain>
      <ModuleDetailView
        module={moduleEntry}
        mandanten={mandanten?.items ?? []}
        appVersion={publicSettings?.appVersion ?? null}
      />
    </PageContent>
  );
}
