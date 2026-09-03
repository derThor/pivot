import { TagsManager } from "@/components/tags-manager";
import { TaxonomyItemDialog } from "@/components/taxonomy-item-dialog";
import { PageContent } from "@/components/page-content";
import { PageHeader } from "@/components/page-header";
import { PaginationControls } from "@/components/pagination-controls";
import { getAllTags, getPublicSettings, getTags } from "@/lib/api-server";

export default async function TagsPage({
  searchParams,
}: {
  searchParams: Promise<{
    page?: string;
    sortBy?: string;
    sortDir?: string;
  }>;
}) {
  const { page: pageParam, sortBy, sortDir: sortDirParam } = await searchParams;
  const sortDir = sortDirParam === "asc" ? "asc" : "desc";
  const page = Number(pageParam) || 1;
  const [settings, allTags] = await Promise.all([
    getPublicSettings(),
    getAllTags(),
  ]);
  const pagedTags = await getTags({
    page,
    pageSize: settings?.defaultPageSize ?? 10,
    sortBy,
    sortDir,
  });

  return (
    <div className="flex flex-col gap-10">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <PageHeader title="Tags" />
        <TaxonomyItemDialog
          apiPath="tags"
          newLabel="Neuer Tag"
          entitySingular="Tag"
        />
      </div>
      <PageContent plain>
        <TagsManager allTags={allTags ?? []} items={pagedTags?.items ?? []} />

        {pagedTags && (
          <PaginationControls
            page={pagedTags.meta.page}
            pageCount={pagedTags.meta.pageCount}
            buildHref={(p) => `?page=${p}`}
          />
        )}
      </PageContent>
    </div>
  );
}
