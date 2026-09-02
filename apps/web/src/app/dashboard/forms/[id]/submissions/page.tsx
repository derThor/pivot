import { notFound } from "next/navigation";
import { PageContent } from "@/components/page-content";
import { PageHeader } from "@/components/page-header";
import { SubmissionsExplorer } from "@/components/submissions-explorer";
import {
  getForm,
  getFormSubmissions,
  getPrivacySettings,
} from "@/lib/api-server";

export default async function FormSubmissionsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { id } = await params;
  const { page: pageParam } = await searchParams;
  const page = Number(pageParam) || 1;

  const [form, result, privacy] = await Promise.all([
    getForm(id),
    getFormSubmissions(id, { page }),
    getPrivacySettings(),
  ]);
  if (!form) notFound();

  // Server Component (kein Client-Rendering/Memoization durch den React
  // Compiler) – ein Zeitstempel pro Seitenaufruf ist hier unproblematisch.
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={`Einsendungen – ${form.name}`} />
      <PageContent plain>
        <SubmissionsExplorer
          items={result?.items ?? []}
          meta={{
            page: result?.meta.page ?? 1,
            pageCount: result?.meta.pageCount ?? 1,
          }}
          fields={form.fields}
          basePath={`/dashboard/forms/${id}/submissions`}
          retentionDays={privacy?.retentionFormSubmissionsDays ?? null}
          now={now}
        />
      </PageContent>
    </div>
  );
}
