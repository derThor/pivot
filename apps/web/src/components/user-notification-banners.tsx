import Link from "next/link";

import { SystemMessage } from "@/components/ui/system-message";
import { Button } from "@/components/ui/button";
import type { PublicSettings, UserNotificationCounts } from "@/lib/api-server";

// Nutzerbezogene Systembenachrichtigungen (2b.14, Nutzervorgabe 2026-08-16):
// gleiches Muster wie StorageQuotaBanner/WebhookFailureBanner – reine
// Zustands-Banner ohne Event-Historie, jede Kategorie einzeln über
// `AppSettings.notify*` ab-/anschaltbar (siehe NotificationSettingsCard).
export function UserNotificationBanners({
  counts,
  settings,
}: {
  counts: UserNotificationCounts | null;
  settings: PublicSettings | null;
}) {
  if (!counts) return null;

  return (
    <>
      {settings?.notifyPendingActivations !== false &&
        counts.pendingActivation > 0 && (
          <SystemMessage
            variant="info"
            title={`${counts.pendingActivation} ${counts.pendingActivation === 1 ? "Nutzer wartet" : "Nutzer warten"} auf Freischaltung`}
            actions={
              <Button
                size="sm"
                variant="outline"
                className="border-[#D4D4D4]"
                render={<Link href="/dashboard/users?status=inactive" />}
              >
                Nutzer ansehen
              </Button>
            }
          />
        )}
      {settings?.notifyFailedLogins !== false && counts.failedLogins > 0 && (
        <SystemMessage
          variant="warning"
          title={`${counts.failedLogins} ${counts.failedLogins === 1 ? "Nutzer hat" : "Nutzer haben"} auffällig viele fehlgeschlagene Login-Versuche`}
          actions={
            <Button
              size="sm"
              variant="outline"
              className="border-[#D4D4D4]"
              render={<Link href="/dashboard/users" />}
            >
              Nutzer ansehen
            </Button>
          }
        />
      )}
      {settings?.notifyPendingPasswordChanges !== false &&
        counts.pendingPasswordChange > 0 && (
          <SystemMessage
            variant="neutral"
            title={`${counts.pendingPasswordChange} ${counts.pendingPasswordChange === 1 ? "Nutzer muss" : "Nutzer müssen"} das Passwort bei der nächsten Anmeldung ändern`}
            actions={
              <Button
                size="sm"
                variant="outline"
                className="border-[#D4D4D4]"
                render={<Link href="/dashboard/users" />}
              >
                Nutzer ansehen
              </Button>
            }
          />
        )}
    </>
  );
}
