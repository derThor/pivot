import { NavigationsManager } from "@/components/navigations-manager";
import { NavigationDialog } from "@/components/navigation-dialog";
import { PageHeader } from "@/components/page-header";
import { PaginationControls } from "@/components/pagination-controls";
import { getNavigations, getPublicSettings } from "@/lib/api-server";

export default async function NavigationPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { page: pageParam } = await searchParams;
  const page = Number(pageParam) || 1;
  const settings = await getPublicSettings();
  const navigations = await getNavigations({
    page,
    pageSize: settings?.defaultPageSize ?? 10,
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <PageHeader title="Menüs" />
        <NavigationDialog />
      </div>
      <NavigationsManager items={navigations?.items ?? []} />

      {navigations && (
        <PaginationControls
          page={navigations.meta.page}
          pageCount={navigations.meta.pageCount}
          buildHref={(p) => `?page=${p}`}
        />
      )}
    </div>
  );
}
