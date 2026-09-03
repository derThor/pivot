import { PageContent } from "@/components/page-content";
import { FormsView } from "@/components/forms-view";
import { getForms, getFormStats } from "@/lib/api-server";
import type { FormStatus } from "@/lib/api-server";

export default async function FormsPage({
  searchParams,
}: {
  searchParams: Promise<{
    page?: string;
    status?: string;
    q?: string;
    sortBy?: string;
    sortDir?: string;
  }>;
}) {
  const {
    page: pageParam,
    status,
    q,
    sortBy,
    sortDir: sortDirParam,
  } = await searchParams;
  const sortDir = sortDirParam === "asc" ? "asc" : "desc";
  const page = Number(pageParam) || 1;

  const [result, stats] = await Promise.all([
    getForms({
      page,
      status: status as FormStatus | undefined,
      q,
      sortBy,
      sortDir,
    }),
    getFormStats(),
  ]);

  return (
    <PageContent plain>
      <FormsView
        items={result?.items ?? []}
        meta={{
          page: result?.meta.page ?? 1,
          pageCount: result?.meta.pageCount ?? 1,
        }}
        stats={
          stats ?? {
            total: 0,
            published: 0,
            draft: 0,
            paused: 0,
            submissionsLast30Days: 0,
            unread: 0,
          }
        }
        activeStatus={(status as FormStatus | undefined) ?? null}
        activeQuery={q ?? ""}
      />
    </PageContent>
  );
}
