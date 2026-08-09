import Link from "next/link";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GlobalModulesManager } from "@/components/global-modules-manager";
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
        {galleryType && (
          <Button render={<Link href="/dashboard/content/galleries/new" />}>
            <Plus />
            Neu anlegen
          </Button>
        )}
      </div>
      {galleryType ? (
        <GlobalModulesManager
          items={items}
          moduleType={galleryType}
          editHrefBase="/dashboard/content/galleries"
        />
      ) : (
        <p className="text-sm text-muted-foreground">
          Kein Galerie-Modul-Typ vorhanden.
        </p>
      )}
    </div>
  );
}
