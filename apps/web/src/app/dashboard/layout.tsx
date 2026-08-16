import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AppSidebar } from "@/components/app-sidebar";
import { DashboardHeader } from "@/components/dashboard-header";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { EmailVerificationBanner } from "@/components/email-verification-banner";
import { ImpersonationBanner } from "@/components/impersonation-banner";
import { NoDashboardAccess } from "@/components/no-dashboard-access";
import { STORAGE_WARNING_THRESHOLD_PERCENT } from "@/components/storage-quota-banner";
import {
  getCurrentUser,
  getMediaStorageUsage,
  getPublicSettings,
  getUserNotificationCounts,
  getWebhooks,
} from "@/lib/api-server";
import { formatName } from "@/lib/utils";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [user, settings] = await Promise.all([
    getCurrentUser(),
    getPublicSettings(),
  ]);
  if (!user) {
    redirect("/login");
  }

  if (user.canAccessDashboard === false) {
    return <NoDashboardAccess user={user} />;
  }

  // Glocken-Badge im Header zeigt die Anzahl aktiver Systemmeldungen
  // (siehe /dashboard/system-messages) – nur für Nutzer mit Zugriff auf
  // diese Seite abgefragt, um unnötige Requests für alle anderen Rollen zu
  // vermeiden. Jede Kategorie ist einzeln über `AppSettings.notify*`
  // ab-/anschaltbar (Nutzervorgabe, 2026-08-16, siehe
  // NotificationSettingsCard) – ausgeschaltete Kategorien fließen weder in
  // den Zähler noch als Banner auf /dashboard/system-messages ein.
  const canViewSystemMessages =
    (user.permissions ?? []).includes("settings:read");
  const canViewUserNotifications = (user.permissions ?? []).includes(
    "users:read",
  );
  // Kein "nur ausblenden": eine per Schalter deaktivierte Kategorie wird
  // gar nicht erst abgefragt (Nutzervorgabe, 2026-08-16, "das Erfassen
  // dieser Nachrichten beenden, wenn nicht aktiv") – spart die jeweilige
  // Anfrage bei jeder Dashboard-Navigation komplett statt sie nur zu
  // ignorieren.
  const [storageUsage, webhooks, userNotificationCounts] = await Promise.all([
    canViewSystemMessages && settings?.notifyStorageQuota !== false ?
      getMediaStorageUsage()
    : null,
    canViewSystemMessages && settings?.notifyWebhookFailures !== false ?
      getWebhooks({ pageSize: 1 })
    : null,
    canViewUserNotifications &&
    (settings?.notifyPendingActivations !== false ||
      settings?.notifyFailedLogins !== false ||
      settings?.notifyPendingPasswordChanges !== false) ?
      getUserNotificationCounts()
    : null,
  ]);
  const systemMessageCount =
    (canViewSystemMessages ?
      Number(
        settings?.notifyMaintenanceMode !== false &&
          Boolean(settings?.maintenanceModeEnabled),
      ) +
      Number(
        settings?.notifyStorageQuota !== false &&
          (storageUsage?.percentUsed ?? 0) >=
            STORAGE_WARNING_THRESHOLD_PERCENT,
      ) +
      Number(
        settings?.notifyWebhookFailures !== false &&
          (webhooks?.meta.failingCount ?? 0) > 0,
      )
    : 0) +
    (canViewUserNotifications ?
      Number(
        settings?.notifyPendingActivations !== false &&
          (userNotificationCounts?.pendingActivation ?? 0) > 0,
      ) +
      Number(
        settings?.notifyFailedLogins !== false &&
          (userNotificationCounts?.failedLogins ?? 0) > 0,
      ) +
      Number(
        settings?.notifyPendingPasswordChanges !== false &&
          (userNotificationCounts?.pendingPasswordChange ?? 0) > 0,
      )
    : 0);

  // Cookie-Name muss mit SIDEBAR_COOKIE_NAME in ui/sidebar.tsx übereinstimmen.
  // Kann nicht importiert werden: sidebar.tsx ist "use client", einfache
  // Konstanten-Exports daraus werden beim Import in eine Server Component
  // zu Client-Referenzen statt echten Werten (kein string mehr).
  const sidebarState = (await cookies()).get("sidebar_state")?.value;
  const defaultOpen = sidebarState !== "false";

  return (
    <SidebarProvider defaultOpen={defaultOpen}>
      <AppSidebar user={user} />
      <SidebarInset>
        {user.impersonatedBy && (
          <ImpersonationBanner targetName={formatName(user)} />
        )}
        {!user.emailVerifiedAt && <EmailVerificationBanner />}
        <DashboardHeader
          user={user}
          defaultPageSize={settings?.defaultPageSize ?? 10}
          systemMessageCount={systemMessageCount}
          notifyLocalDrafts={settings?.notifyLocalDrafts !== false}
        />
        <div className="flex min-w-0 flex-1 flex-col gap-6 bg-background px-5 pt-4 pb-5 sm:px-10 sm:pt-6 sm:pb-10">
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
