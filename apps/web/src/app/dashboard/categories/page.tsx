import { TaxonomyManager } from "@/components/taxonomy-manager";
import { TaxonomyItemDialog } from "@/components/taxonomy-item-dialog";
import { PaginationControls } from "@/components/pagination-controls";
import { getCategories, getPublicSettings } from "@/lib/api-server";

export default async function CategoriesPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { page: pageParam } = await searchParams;
  const page = Number(pageParam) || 1;
  const settings = await getPublicSettings();
  const categories = await getCategories({
    page,
    pageSize: settings?.defaultPageSize ?? 10,
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Kategorien
          </h1>
          <p className="text-sm text-muted-foreground">
            Kategorien zur Einordnung von Inhalten.
          </p>
        </div>
        <TaxonomyItemDialog
          apiPath="categories"
          withDescription
          newLabel="Neue Kategorie"
          entitySingular="Kategorie"
        />
      </div>
      <TaxonomyManager
        apiPath="categories"
        items={categories?.items ?? []}
        withDescription
        newLabel="Neue Kategorie"
        entitySingular="Kategorie"
        entityLabelPlural="Kategorien"
      />

      {categories && (
        <PaginationControls
          page={categories.meta.page}
          pageCount={categories.meta.pageCount}
          buildHref={(p) => `?page=${p}`}
        />
      )}
    </div>
  );
}
