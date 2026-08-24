import { PageContent } from "@/components/page-content";
import { WebsitesView } from "@/components/websites-view";
import { getSettings, getWebsites } from "@/lib/api-server";

// Master-exklusiv (siehe knowledge-base/platform/master-slave-licensing.md)
// – der Sidebar-Punkt "Administration > Webseite" wird auf einer Client-
// Installation gar nicht erst angezeigt (app-sidebar.tsx, `isMaster`),
// diese Seite bliebe dort aber technisch trotzdem erreichbar; das Backend
// gated `GET /websites` ohnehin über `MasterOnlyGuard`. Die Wartungsseiten-
// Konfiguration für DIESE Installation liegt separat unter Einstellungen →
// Wartungsseite, nicht hier.
export default async function WebsitesPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { page: pageParam } = await searchParams;
  const page = Number(pageParam) || 1;

  const settings = await getSettings();
  const result = await getWebsites({
    page,
    pageSize: settings?.defaultPageSize ?? 10,
  });

  return (
    <PageContent plain>
      <WebsitesView
        items={result?.items ?? []}
        meta={{
          page: result?.meta.page ?? 1,
          pageCount: result?.meta.pageCount ?? 1,
        }}
      />
    </PageContent>
  );
}
