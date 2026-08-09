import { GlobalModulesManager } from "@/components/global-modules-manager";
import { GlobalModuleDialog } from "@/components/global-module-dialog";
import { PageHeader } from "@/components/page-header";
import { isGalleryModuleType } from "@/components/block-field-output";
import { getGlobalModules, getModuleTypes } from "@/lib/api-server";

export default async function GalleriesPage() {
  const [globalModules, moduleTypes] = await Promise.all([
    getGlobalModules(),
    getModuleTypes(),
  ]);

  const galleryType = (moduleTypes ?? []).find((mt) =>
    isGalleryModuleType(mt.schema.fields),
  );
  const items = galleryType
    ? (globalModules ?? []).filter((gm) => gm.moduleTypeId === galleryType.id)
    : [];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <PageHeader title="Galerien" />
        {galleryType && <GlobalModuleDialog moduleType={galleryType} />}
      </div>
      {galleryType ? (
        <GlobalModulesManager items={items} moduleType={galleryType} />
      ) : (
        <p className="text-sm text-muted-foreground">
          Kein Galerie-Modul-Typ vorhanden.
        </p>
      )}
    </div>
  );
}
