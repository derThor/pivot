import { TaxonomyManager } from "@/components/taxonomy-manager";
import { TaxonomyItemDialog } from "@/components/taxonomy-item-dialog";
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
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Tags</h1>
          <p className="text-sm text-muted-foreground">
            Tags zur Einordnung von Inhalten.
          </p>
        </div>
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
