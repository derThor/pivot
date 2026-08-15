import { GalleryDialog } from "@/components/gallery-dialog";
import { GalleryGrid } from "@/components/gallery-grid";
import { PageContent } from "@/components/page-content";
import { PageHeader } from "@/components/page-header";
import { PaginationControls } from "@/components/pagination-controls";
import { isGalleryModuleType } from "@/components/block-field-output";
import {
  getGlobalModulesPaged,
  getModuleTypes,
  getPublicSettings,
} from "@/lib/api-server";

export default async function GalleriesPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { page: pageParam } = await searchParams;
  const page = Number(pageParam) || 1;
  const [moduleTypes, settings] = await Promise.all([
    getModuleTypes(),
    getPublicSettings(),
  ]);

  const galleryType = (moduleTypes ?? []).find((mt) =>
    isGalleryModuleType(mt.schema.fields),
  );
  const globalModules = galleryType
    ? await getGlobalModulesPaged({
        moduleTypeId: galleryType.id,
        page,
        pageSize: settings?.defaultPageSize ?? 10,
      })
    : null;

  return (
    <div className="flex flex-col gap-10">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <PageHeader title="Galerien" />
        {galleryType && <GalleryDialog moduleType={galleryType} />}
      </div>
      <PageContent plain>
        {galleryType ? (
          <>
            <GalleryGrid
              items={globalModules?.items ?? []}
              moduleType={galleryType}
            />
            {globalModules && (
              <PaginationControls
                page={globalModules.meta.page}
                pageCount={globalModules.meta.pageCount}
                buildHref={(p) => `?page=${p}`}
              />
            )}
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            Kein Galerie-Modul-Typ vorhanden.
          </p>
        )}
      </PageContent>
    </div>
  );
}
