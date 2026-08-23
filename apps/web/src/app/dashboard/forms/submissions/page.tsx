import { PageContent } from "@/components/page-content";
import { PageHeader } from "@/components/page-header";
import { SubmissionsTable } from "@/components/submissions-table";
import { getAllFormSubmissions, getPrivacySettings } from "@/lib/api-server";

export default async function AllFormSubmissionsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { page: pageParam } = await searchParams;
  const page = Number(pageParam) || 1;

  const [result, privacy] = await Promise.all([
    getAllFormSubmissions({ page }),
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
        <SubmissionsTable
          items={result?.items ?? []}
          meta={{ page: result?.meta.page ?? 1, pageCount: result?.meta.pageCount ?? 1 }}
          showForm
          basePath="/dashboard/forms/submissions"
          retentionDays={privacy?.retentionFormSubmissionsDays ?? null}
          now={now}
        />
      </PageContent>
    </div>
  );
}
