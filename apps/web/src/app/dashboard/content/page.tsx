import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { getContentList, getPublicSettings } from "@/lib/api-server";
import { ContentTable } from "@/components/content-table";
import { PageHeader } from "@/components/page-header";
import { PaginationControls } from "@/components/pagination-controls";

export default async function ContentPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { page: pageParam } = await searchParams;
  const page = Number(pageParam) || 1;

  const settings = await getPublicSettings();
  const content = await getContentList({
    page,
    pageSize: settings?.defaultPageSize ?? 10,
  });
  const entries = content?.items ?? [];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <PageHeader title="Seiten" />
        <Button render={<Link href="/dashboard/content/new" />}>
          <Plus />
          Neue Seite
        </Button>
      </div>

      <ContentTable entries={entries} />

      {content && (
        <PaginationControls
          page={content.meta.page}
          pageCount={content.meta.pageCount}
          buildHref={(p) => `?page=${p}`}
        />
      )}
    </div>
  );
}
