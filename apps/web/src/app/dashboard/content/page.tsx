import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { getContentList, getPublicSettings } from "@/lib/api-server";
import { ContentTable } from "@/components/content-table";
import { PageContent } from "@/components/page-content";
import { PageHeader } from "@/components/page-header";
import { PaginationControls } from "@/components/pagination-controls";
import { StatCard } from "@/components/stat-card";

export default async function ContentPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { page: pageParam } = await searchParams;
  const page = Number(pageParam) || 1;

  const settings = await getPublicSettings();
  const [content, published, drafts, scheduled] = await Promise.all([
    getContentList({ page, pageSize: settings?.defaultPageSize ?? 10 }),
    getContentList({ status: "PUBLISHED", pageSize: 1 }),
    getContentList({ status: "DRAFT", pageSize: 1 }),
    getContentList({ status: "SCHEDULED", pageSize: 1 }),
  ]);
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

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Seiten gesamt"
          value={String(content?.meta.total ?? 0)}
          sublabel="Alle Status"
        />
        <StatCard
          label="Veröffentlicht"
          value={String(published?.meta.total ?? 0)}
          sublabel="Live auf der Website"
          valueClassName="text-emerald-600"
        />
        <StatCard
          label="Entwürfe"
          value={String(drafts?.meta.total ?? 0)}
          sublabel="Noch nicht veröffentlicht"
        />
        <StatCard
          label="Geplant"
          value={String(scheduled?.meta.total ?? 0)}
          sublabel="Automatische Veröffentlichung"
          valueClassName="text-amber-600"
        />
      </div>

      <PageContent plain>
        <ContentTable entries={entries} />

        {content && (
          <PaginationControls
            page={content.meta.page}
            pageCount={content.meta.pageCount}
            buildHref={(p) => `?page=${p}`}
          />
        )}
      </PageContent>
    </div>
  );
}
