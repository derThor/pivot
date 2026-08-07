import { WebhooksManager } from "@/components/webhooks-manager";
import { WebhookDialog } from "@/components/webhook-dialog";
import { PaginationControls } from "@/components/pagination-controls";
import { getPublicSettings, getWebhooks } from "@/lib/api-server";

export default async function WebhooksPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { page: pageParam } = await searchParams;
  const page = Number(pageParam) || 1;
  const settings = await getPublicSettings();
  const webhooks = await getWebhooks({
    page,
    pageSize: settings?.defaultPageSize ?? 10,
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Webhooks</h1>
          <p className="text-sm text-muted-foreground">
            Externe Systeme benachrichtigen, wenn Inhalte veröffentlicht oder
            geändert werden.
          </p>
        </div>
        <WebhookDialog />
      </div>
      <WebhooksManager items={webhooks?.items ?? []} />

      {webhooks && (
        <PaginationControls
          page={webhooks.meta.page}
          pageCount={webhooks.meta.pageCount}
          buildHref={(p) => `?page=${p}`}
        />
      )}
    </div>
  );
}
