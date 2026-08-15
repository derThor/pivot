import { NavigationDialog } from "@/components/navigation-dialog";
import { NavigationExplorer } from "@/components/navigation-explorer";
import { PageContent } from "@/components/page-content";
import { PageHeader } from "@/components/page-header";
import { getContentList, getNavigation, getNavigations } from "@/lib/api-server";

export default async function NavigationPage({
  searchParams,
}: {
  searchParams: Promise<{ menu?: string }>;
}) {
  const { menu } = await searchParams;
  const [navigations, content] = await Promise.all([
    getNavigations({ pageSize: 100 }),
    getContentList({ pageSize: 100 }),
  ]);

  const menus = navigations?.items ?? [];
  const selectedMenuId =
    menu && menus.some((m) => m.id === menu) ? menu : (menus[0]?.id ?? null);
  const navigation = selectedMenuId ? await getNavigation(selectedMenuId) : null;

  return (
    <div className="flex flex-col gap-10">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <PageHeader title="Menüs" />
        <NavigationDialog />
      </div>
      <PageContent plain>
        <NavigationExplorer
          menus={menus}
          selectedMenuId={selectedMenuId}
          navigation={navigation ?? null}
          contentItems={content?.items ?? []}
        />
      </PageContent>
    </div>
  );
}
