import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { getContentList, getPublicSettings } from "@/lib/api-server";
import { ContentTable } from "@/components/content-table";
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Inhalte</h1>
          <p className="text-sm text-muted-foreground">
            Alle Content-Einträge deines CMS an einem Ort.
          </p>
        </div>
        <Button render={<Link href="/dashboard/content/new" />}>
          <Plus />
          Neuer Inhalt
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
