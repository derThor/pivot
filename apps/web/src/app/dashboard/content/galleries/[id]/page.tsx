import { notFound } from "next/navigation";
import { GlobalModulePageForm } from "@/components/global-module-page-form";
import { PageHeader } from "@/components/page-header";
import { getGlobalModule, getModuleTypes } from "@/lib/api-server";

export default async function EditGalleryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [globalModule, moduleTypes] = await Promise.all([
    getGlobalModule(id),
    getModuleTypes(),
  ]);

  if (!globalModule) notFound();

  const moduleType = (moduleTypes ?? []).find(
    (mt) => mt.id === globalModule.moduleTypeId,
  );
  if (!moduleType) notFound();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={globalModule.name} />
      <GlobalModulePageForm
        moduleType={moduleType}
        globalModule={globalModule}
        redirectTo="/dashboard/content/galleries"
      />
    </div>
  );
}
