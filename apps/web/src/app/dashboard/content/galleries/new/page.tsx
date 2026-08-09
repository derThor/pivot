import { notFound } from "next/navigation";
import { GlobalModulePageForm } from "@/components/global-module-page-form";
import { PageHeader } from "@/components/page-header";
import { isGalleryModuleType } from "@/components/block-field-output";
import { getModuleTypes } from "@/lib/api-server";

export default async function NewGalleryPage() {
  const moduleTypes = await getModuleTypes();
  const galleryType = (moduleTypes ?? []).find((mt) =>
    isGalleryModuleType(mt.schema.fields),
  );

  if (!galleryType) notFound();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Neue Galerie" />
      <GlobalModulePageForm
        moduleType={galleryType}
        redirectTo="/dashboard/content/galleries"
      />
    </div>
  );
}
