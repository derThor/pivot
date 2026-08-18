import { PageContent } from "@/components/page-content";
import { TrashView } from "@/components/trash-view";
import { getTrash } from "@/lib/api-server";
import type { TrashType } from "@/lib/api-server";

export default async function TrashPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; q?: string }>;
}) {
  const { type, q } = await searchParams;
  const result = await getTrash({ type: type as TrashType | undefined, q });

  return (
    <PageContent plain>
      <TrashView
        items={result?.items ?? []}
        stats={
          result?.stats ?? {
            total: 0,
            expiringSoonCount: 0,
            storageBytes: 0,
            retentionDays: 30,
            typesCount: 0,
            countsByType: {},
          }
        }
        activeType={(type as TrashType | undefined) ?? null}
        activeQuery={q ?? ""}
      />
    </PageContent>
  );
}
