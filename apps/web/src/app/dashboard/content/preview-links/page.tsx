import { PreviewLinksTable } from "@/components/preview-links-table";
import { PaginationControls } from "@/components/pagination-controls";
import { getAllPreviewLinks, getPublicSettings } from "@/lib/api-server";

export default async function PreviewLinksPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { page: pageParam } = await searchParams;
  const page = Number(pageParam) || 1;
  const settings = await getPublicSettings();
  const previewLinks = await getAllPreviewLinks({
    page,
    pageSize: settings?.defaultPageSize ?? 10,
  });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Vorschau-Links
        </h1>
        <p className="text-sm text-muted-foreground">
          Alle aktiven Vorschau-Links über sämtliche Inhalte hinweg –
          erstellen lässt sich ein neuer Link direkt im Editor des jeweiligen
          Inhalts.
        </p>
      </div>
      <PreviewLinksTable items={previewLinks?.items ?? []} />

      {previewLinks && (
        <PaginationControls
          page={previewLinks.meta.page}
          pageCount={previewLinks.meta.pageCount}
          buildHref={(p) => `?page=${p}`}
        />
      )}
    </div>
  );
}
