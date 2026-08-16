import { LocalDraftsSection } from "@/components/local-drafts-section";
import { NotificationSettingsCard } from "@/components/notification-settings-card";
import { PageContent } from "@/components/page-content";
import { PageHeader } from "@/components/page-header";
import { StorageQuotaBanner } from "@/components/storage-quota-banner";
import { SystemMessagesEmptyState } from "@/components/system-messages-empty-state";
import { UserNotificationBanners } from "@/components/user-notification-banners";
import { WebhookFailureBanner } from "@/components/webhook-failure-banner";
import { SystemMessage } from "@/components/ui/system-message";
import {
  getCurrentUser,
  getMediaStorageUsage,
  getPublicSettings,
  getUserNotificationCounts,
  getWebhooks,
} from "@/lib/api-server";

/** Sammelt an einem Ort, welche der app-weiten `SystemMessage`-Banner
 * (siehe knowledge-base/frontend/toast-and-system-messages.md) gerade aktiv
 * wären – dieselben Datenquellen/Schwellenwerte wie Dashboard/Medien/
 * Webhooks-Seite, hier nur zentral zusammengefasst statt verstreut. Jede
 * Kategorie ist über die rechte "Benachrichtigungen"-Karte einzeln
 * ab-/anschaltbar (Nutzervorgabe, 2026-08-16). */
export default async function SystemMessagesPage() {
  const [currentUser, settings] = await Promise.all([
    getCurrentUser(),
    getPublicSettings(),
  ]);
  const canViewUserNotifications = (
    currentUser?.permissions ?? []
  ).includes("users:read");

  // Kein "nur ausblenden": eine per Schalter deaktivierte Kategorie wird
  // gar nicht erst abgefragt (Nutzervorgabe, 2026-08-16, "das Erfassen
  // dieser Nachrichten beenden, wenn nicht aktiv").
  const [storageUsage, webhooks, userNotificationCounts] = await Promise.all([
    settings?.notifyStorageQuota !== false ? getMediaStorageUsage() : null,
    settings?.notifyWebhookFailures !== false ?
      getWebhooks({ pageSize: 1 })
    : null,
    canViewUserNotifications &&
    (settings?.notifyPendingActivations !== false ||
      settings?.notifyFailedLogins !== false ||
      settings?.notifyPendingPasswordChanges !== false) ?
      getUserNotificationCounts()
    : null,
  ]);

  const maintenanceActive =
    settings?.notifyMaintenanceMode !== false &&
    Boolean(settings?.maintenanceModeEnabled);
  const storageWarning =
    settings?.notifyStorageQuota !== false &&
    (storageUsage?.percentUsed ?? 0) >= 90;
  const failingCount =
    settings?.notifyWebhookFailures !== false ?
      (webhooks?.meta.failingCount ?? 0)
    : 0;
  const hasUserNotification =
    canViewUserNotifications &&
    ((settings?.notifyPendingActivations !== false &&
      (userNotificationCounts?.pendingActivation ?? 0) > 0) ||
      (settings?.notifyFailedLogins !== false &&
        (userNotificationCounts?.failedLogins ?? 0) > 0) ||
      (settings?.notifyPendingPasswordChanges !== false &&
        (userNotificationCounts?.pendingPasswordChange ?? 0) > 0));
  const hasAnyServerMessage =
    maintenanceActive || storageWarning || failingCount > 0 || hasUserNotification;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Systemnachrichten" />
      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-3">
        <PageContent plain className="gap-3 lg:col-span-2">
          {maintenanceActive && (
            <SystemMessage
              variant="neutral"
              title="Wartungsmodus aktiv"
              description="Die Website ist aktuell im Wartungsmodus und für Besucher nicht erreichbar."
            />
          )}
          {storageWarning && <StorageQuotaBanner usage={storageUsage} />}
          {settings?.notifyWebhookFailures !== false && (
            <WebhookFailureBanner failingCount={failingCount} />
          )}
          {canViewUserNotifications && (
            <UserNotificationBanners
              counts={userNotificationCounts}
              settings={settings}
            />
          )}
          <LocalDraftsSection enabled={settings?.notifyLocalDrafts !== false} />
          <SystemMessagesEmptyState hasAnyServerMessage={hasAnyServerMessage} />
        </PageContent>

        {settings &&
          (currentUser?.permissions ?? []).includes("settings:update") && (
          <NotificationSettingsCard
            settings={{
              notifyMaintenanceMode: settings.notifyMaintenanceMode,
              notifyStorageQuota: settings.notifyStorageQuota,
              notifyWebhookFailures: settings.notifyWebhookFailures,
              notifyLocalDrafts: settings.notifyLocalDrafts,
              notifyPendingActivations: settings.notifyPendingActivations,
              notifyFailedLogins: settings.notifyFailedLogins,
              notifyPendingPasswordChanges:
                settings.notifyPendingPasswordChanges,
            }}
          />
        )}
      </div>
    </div>
  );
}
