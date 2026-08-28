import { notFound } from "next/navigation";
import { PageContent } from "@/components/page-content";
import { MandantDetailView } from "@/components/mandant-detail-view";
import {
  getMandant,
  getMandantModuleCatalog,
  getMediaFolders,
} from "@/lib/api-server";

export default async function MandantDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [mandant, moduleCatalog, folders] = await Promise.all([
    getMandant(id),
    getMandantModuleCatalog(),
    getMediaFolders(),
  ]);
  if (!mandant) {
    notFound();
  }
  // Gleicher "Logo"-Systemordner wie das Firmenlogo unter Einstellungen
  // (siehe dashboard/settings/page.tsx) – kein eigener Ordner nötig.
  const logoFolderId =
    folders?.find((folder) => folder.isSystem && folder.name === "Logo")?.id ??
    null;

  return (
    <PageContent plain>
      <MandantDetailView
        mandant={mandant}
        moduleCatalog={moduleCatalog ?? []}
        logoFolderId={logoFolderId}
      />
    </PageContent>
  );
}
