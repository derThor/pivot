import { PageContent } from "@/components/page-content";
import { PageHeader } from "@/components/page-header";
import { SubmissionsExplorer } from "@/components/submissions-explorer";
import { getAllFormSubmissions, getPrivacySettings } from "@/lib/api-server";

export default async function AllFormSubmissionsPage({
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

  const [result, privacy] = await Promise.all([
    getAllFormSubmissions({ page, sortBy, sortDir }),
    getPrivacySettings(),
  ]);

  // Server Component (kein Client-Rendering/Memoization durch den React
  // Compiler) – ein Zeitstempel pro Seitenaufruf ist hier unproblematisch.
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Einsendungen" />
      <PageContent plain>
        <SubmissionsExplorer
          items={result?.items ?? []}
          meta={{
            page: result?.meta.page ?? 1,
            pageCount: result?.meta.pageCount ?? 1,
          }}
          showForm
          basePath="/dashboard/forms/submissions"
          retentionDays={privacy?.retentionFormSubmissionsDays ?? null}
          now={now}
        />
      </PageContent>
    </div>
  );
}
