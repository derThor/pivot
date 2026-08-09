import { TaxonomyManager } from "@/components/taxonomy-manager";
import { TaxonomyItemDialog } from "@/components/taxonomy-item-dialog";
import { PageHeader } from "@/components/page-header";
import { PaginationControls } from "@/components/pagination-controls";
import { getPublicSettings, getTags } from "@/lib/api-server";

export default async function TagsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { page: pageParam } = await searchParams;
  const page = Number(pageParam) || 1;
  const settings = await getPublicSettings();
  const tags = await getTags({
    page,
    pageSize: settings?.defaultPageSize ?? 10,
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <PageHeader title="Tags" />
        <TaxonomyItemDialog
          apiPath="tags"
          newLabel="Neuer Tag"
          entitySingular="Tag"
        />
      </div>
      <TaxonomyManager
        apiPath="tags"
        items={tags?.items ?? []}
        newLabel="Neuer Tag"
        entitySingular="Tag"
        entityLabelPlural="Tags"
      />

      {tags && (
        <PaginationControls
          page={tags.meta.page}
          pageCount={tags.meta.pageCount}
          buildHref={(p) => `?page=${p}`}
        />
      )}
    </div>
  );
}
