import { TaxonomyManager } from "@/components/taxonomy-manager";
import { TaxonomyItemDialog } from "@/components/taxonomy-item-dialog";
import { PageHeader } from "@/components/page-header";
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
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <PageHeader title="Kategorien" />
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
