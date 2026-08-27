import { PageContent } from "@/components/page-content";
import { MandantenView } from "@/components/mandanten-view";
import { getMandanten, getMandantStats, getSettings } from "@/lib/api-server";

// Master-exklusiv (siehe knowledge-base/platform/master-slave-licensing.md)
// – gleiches Muster wie /dashboard/websites: der Sidebar-Punkt wird auf
// einer Client-Installation gar nicht erst angezeigt, das Backend gated
// zusätzlich hart über `MasterOnlyGuard`.
export default async function MandantenPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { page: pageParam } = await searchParams;
  const page = Number(pageParam) || 1;

  const settings = await getSettings();
  const [result, stats] = await Promise.all([
    getMandanten({ page, pageSize: settings?.defaultPageSize ?? 10 }),
    getMandantStats(),
  ]);

  return (
    <PageContent plain>
      <MandantenView
        items={result?.items ?? []}
        meta={{
          page: result?.meta.page ?? 1,
          pageCount: result?.meta.pageCount ?? 1,
        }}
        stats={
          stats ?? {
            mandantsTotal: 0,
            mandantsActive: 0,
            websitesTotal: 0,
            moduleBookingsTotal: 0,
            modulesAvailableCount: 0,
            lockedOrInactiveCount: 0,
            withLockReasonCount: 0,
          }
        }
      />
    </PageContent>
  );
}
