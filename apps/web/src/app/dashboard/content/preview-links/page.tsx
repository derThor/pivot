import { CreatePreviewLinkDialog } from "@/components/create-preview-link-dialog";
import { PreviewLinksTable } from "@/components/preview-links-table";
import { PageContent } from "@/components/page-content";
import { PageHeader } from "@/components/page-header";
import { PaginationControls } from "@/components/pagination-controls";
import {
  getAllPreviewLinks,
  getContentList,
  getPublicSettings,
} from "@/lib/api-server";

export default async function PreviewLinksPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { page: pageParam } = await searchParams;
  const page = Number(pageParam) || 1;
  const [settings, content] = await Promise.all([
    getPublicSettings(),
    getContentList({ pageSize: 100 }),
  ]);
  const previewLinks = await getAllPreviewLinks({
    page,
    pageSize: settings?.defaultPageSize ?? 10,
  });

  return (
    <div className="flex flex-col gap-10">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <PageHeader title="Vorschau-Links" />
        <CreatePreviewLinkDialog contentItems={content?.items ?? []} />
      </div>
      <PageContent plain>
        <PreviewLinksTable items={previewLinks?.items ?? []} />

        {previewLinks && (
          <PaginationControls
            page={previewLinks.meta.page}
            pageCount={previewLinks.meta.pageCount}
            buildHref={(p) => `?page=${p}`}
          />
        )}
      </PageContent>
    </div>
  );
}
