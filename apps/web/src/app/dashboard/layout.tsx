import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AppSidebar } from "@/components/app-sidebar";
import { DashboardHeader } from "@/components/dashboard-header";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { AccountLockBanner } from "@/components/account-lock-banner";
import { EmailVerificationBanner } from "@/components/email-verification-banner";
import { ImpersonationBanner } from "@/components/impersonation-banner";
import { LicenseDevelopmentToast } from "@/components/license-development-toast";
import { NoDashboardAccess } from "@/components/no-dashboard-access";
import { SystemMessage } from "@/components/ui/system-message";
import {
  getCurrentUser,
  getLicenseState,
  getNotifications,
  getUnreadSubmissionCount,
  getPublicSettings,
} from "@/lib/api-server";
import { formatName } from "@/lib/utils";
import { buildAccentColorCss } from "@/lib/accent-color";

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

  // Glocken-Badge im Header zeigt die Anzahl ungelesener Einträge im
  // echten Benachrichtigungs-Postfach (Nutzervorgabe, 2026-08-21, Umbau
  // von /dashboard/system-messages auf ein persistentes Postfach) –
  // `getNotifications()` synct dabei serverseitig die aktuell
  // zutreffenden Bedingungen (siehe NotificationsService.sync()), bevor
  // der Ungelesen-Zähler gebildet wird.
  const notifications = await getNotifications();
  const systemMessageCount = (notifications ?? []).filter(
    (n) => !n.isRead,
  ).length;

  // Briefsymbol in der Kopfzeile (Nutzervorgabe, 2026-09-03) – kurzer Weg
  // zu den Einsendungen, mit dem Ungelesen-Stand als Abzeichen. `null`
  // bei fehlendem `form-submissions:read`: dann bleibt das Symbol aus,
  // sonst führte es in eine Sackgasse.
  const submissionCounts = await getUnreadSubmissionCount();

  // Präsenter Hinweis für Client-Installationen (Nutzervorgabe, siehe
  // knowledge-base/platform/master-slave-licensing.md) – nur bei
  // "development" (bewusst von der Lizenzprüfung ausgenommen) oder
  // "unchecked"/"pending" (Lizenzprüfung noch offen/überfällig, aber noch
  // innerhalb der Karenzzeit) relevant. "locked" wird nie hier sichtbar,
  // da der Backend-Guard das Dashboard dann bereits komplett blockt.
  // Datenschutz-als-Modul (Nutzervorgabe, 2026-08-28): jetzt auf Master
  // UND Slave abgefragt (vorher nur Slave, nur für den
  // Entwicklungsmodus-Hinweis gebraucht) – `moduleFeatures` steuert
  // zusätzlich, welche Verwaltung-Menüpunkte mit `moduleKey` (aktuell nur
  // "Datenschutz") überhaupt angezeigt werden.
  const licenseState = await getLicenseState();
  const enabledModules =
    licenseState && "moduleFeatures" in licenseState
      ? Object.entries(licenseState.moduleFeatures)
          .filter(([, features]) => features.length > 0)
          .map(([key]) => key)
      : [];

  // Cookie-Name muss mit SIDEBAR_COOKIE_NAME in ui/sidebar.tsx übereinstimmen.
  // Kann nicht importiert werden: sidebar.tsx ist "use client", einfache
  // Konstanten-Exports daraus werden beim Import in eine Server Component
  // zu Client-Referenzen statt echten Werten (kein string mehr).
  const sidebarState = (await cookies()).get("sidebar_state")?.value;
  // Kein Cookie gesetzt (erster Besuch/neuer Browser) → Fallback auf den
  // globalen Darstellung-Standard statt hart "offen" (Nutzervorgabe,
  // 2026-08-17, "Seitenleiste eingeklappt starten"). Ein bereits vom Nutzer
  // gesetztes Cookie hat immer Vorrang.
  const defaultOpen =
    sidebarState != null
      ? sidebarState !== "false"
      : !settings?.sidebarCollapsedByDefault;

  return (
    <div
      id="accent-scope"
      data-density={settings?.tableDensity ?? "normal"}
      data-reduce-motion={settings?.reduceMotion ? "true" : undefined}
    >
      {settings?.accentColor && (
        <style
          dangerouslySetInnerHTML={{
            __html: buildAccentColorCss(settings.accentColor),
          }}
        />
      )}
      <SidebarProvider defaultOpen={defaultOpen}>
        <AppSidebar user={user} />
        <SidebarInset>
          {user.impersonatedBy && (
            <ImpersonationBanner targetName={formatName(user)} />
          )}
          {/* Nutzer-Bugreport, 2026-08-25: "Toast kommt nicht sofort und
           * zuverlässig bei Entwicklerstatus" – lag am rein serverseitigen,
           * einmaligen Render dieses Layouts (Next.js re-fetcht es nicht bei
           * jeder Client-Navigation). Läuft deshalb unconditional für jede
           * Client-Installation mit und holt/überwacht den Status seitdem
           * selbst, siehe dortiger Kommentar. */}
          {user.deploymentMode === "slave" && <LicenseDevelopmentToast />}
          {licenseState?.mode === "slave" &&
            licenseState.status === "unchecked" && (
              <SystemMessage
                variant="warning"
                title="Lizenzprüfung ausstehend"
                description="Diese Installation wurde noch nicht erfolgreich beim Master geprüft."
              />
            )}
          {licenseState?.mode === "slave" &&
            licenseState.status === "pending" && (
              <SystemMessage
                variant="warning"
                title="Lizenzprüfung ausstehend"
                description={`Das letzte Lizenz-Token ist abgelaufen, ein erneuter Abruf steht noch aus (Ablauf: ${new Date(licenseState.expiresAt).toLocaleDateString("de-DE")}).`}
              />
            )}
          {user.mustChangePassword ? (
            <AccountLockBanner reason="password" />
          ) : (
            user.twoFactorSetupRequired && <AccountLockBanner reason="2fa" />
          )}
          {!user.emailVerifiedAt && <EmailVerificationBanner />}
          <DashboardHeader
            user={user}
            defaultPageSize={settings?.defaultPageSize ?? 10}
            systemMessageCount={systemMessageCount}
            unreadSubmissionCount={submissionCounts?.unread ?? null}
            allowTwoFactor={settings?.allowTwoFactor ?? false}
            keyboardShortcutsEnabled={
              settings?.keyboardShortcutsEnabled !== false
            }
            enabledModules={enabledModules}
          />
          <div className="flex min-w-0 flex-1 flex-col gap-6 bg-background px-5 pt-4 pb-5 sm:px-10 sm:pt-6 sm:pb-10">
            {children}
          </div>
        </SidebarInset>
      </SidebarProvider>
    </div>
  );
}
