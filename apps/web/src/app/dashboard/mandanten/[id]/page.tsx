import { notFound } from "next/navigation";
import { PageContent } from "@/components/page-content";
import { MandantDetailView } from "@/components/mandant-detail-view";
import { getMandant, getMandantModuleCatalog } from "@/lib/api-server";

export default async function MandantDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [mandant, moduleCatalog] = await Promise.all([
    getMandant(id),
    getMandantModuleCatalog(),
  ]);
  if (!mandant) {
    notFound();
  }

  return (
    <PageContent plain>
      <MandantDetailView
        mandant={mandant}
        moduleCatalog={moduleCatalog ?? []}
      />
    </PageContent>
  );
}
