import { LocalDraftsSection } from "@/components/local-drafts-section";
import { PageContent } from "@/components/page-content";
import { PageHeader } from "@/components/page-header";
import { StorageQuotaBanner } from "@/components/storage-quota-banner";
import { SystemMessagesEmptyState } from "@/components/system-messages-empty-state";
import { WebhookFailureBanner } from "@/components/webhook-failure-banner";
import { SystemMessage } from "@/components/ui/system-message";
import {
  getMediaStorageUsage,
  getPublicSettings,
  getWebhooks,
} from "@/lib/api-server";

/** Sammelt an einem Ort, welche der app-weiten `SystemMessage`-Banner
 * (siehe knowledge-base/frontend/toast-and-system-messages.md) gerade aktiv
 * wären – dieselben Datenquellen/Schwellenwerte wie Dashboard/Medien/
 * Webhooks-Seite, hier nur zentral zusammengefasst statt verstreut. */
export default async function SystemMessagesPage() {
  const [settings, storageUsage, webhooks] = await Promise.all([
    getPublicSettings(),
    getMediaStorageUsage(),
    getWebhooks({ pageSize: 1 }),
  ]);

  const maintenanceActive = Boolean(settings?.maintenanceModeEnabled);
  const storageWarning = (storageUsage?.percentUsed ?? 0) >= 90;
  const failingCount = webhooks?.meta.failingCount ?? 0;
  const hasAnyServerMessage = maintenanceActive || storageWarning || failingCount > 0;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Systemnachrichten" />
      <PageContent plain className="gap-3">
        {maintenanceActive && (
          <SystemMessage
            variant="neutral"
            title="Wartungsmodus aktiv"
            description="Die Website ist aktuell im Wartungsmodus und für Besucher nicht erreichbar."
          />
        )}
        <StorageQuotaBanner usage={storageUsage} />
        <WebhookFailureBanner failingCount={failingCount} />
        <LocalDraftsSection />
        <SystemMessagesEmptyState hasAnyServerMessage={hasAnyServerMessage} />
      </PageContent>
    </div>
  );
}
