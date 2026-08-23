"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";

import { toastDeleted } from "@/components/app-toast";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ConfirmDeleteDialog } from "@/components/confirm-delete-dialog";
import { PaginationControls } from "@/components/pagination-controls";
import { formatName } from "@/lib/utils";
import type { SettingsChangeEntry, SettingsChangesResponse } from "@/lib/api-server";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

// Deutsche Kurz-Labels für alle Felder, die über SettingsService.update()
// als "settings.field_updated" protokolliert werden (siehe dort – bewusst
// nur echte, allgemeine Einstellungen, keine Firma-/Datenschutz-Felder,
// die haben ihre eigene Historie). 1:1 dieselben Texte wie die
// zugehörigen Formularfelder in diesem Formular bzw. in
// notification-settings-card.tsx, damit ein Protokoll-Eintrag genau das
// benennt, was in der UI auch so heißt.
const FIELD_LABELS: Record<string, string> = {
  allowRegistration: "Registrierung erlauben",
  allowPasswordReset: "Passwort-vergessen erlauben",
  allowEmailChange: "Benutzer können E-Mail-Adresse anpassen",
  allowAdminEmailChange: "Administratoren können E-Mail-Adresse anpassen",
  requireAdminActivation: "Admin-Freischaltung erforderlich",
  autosaveEnabled: "Autosave im Content-Editor",
  mediaResponsiveVariantsEnabled: "Automatische Bildvarianten",
  maintenanceModeEnabled: "Wartungsmodus",
  mediaStorageQuotaMb: "Medien-Speicherkontingent",
  maxUploadSizeMb: "Maximale Dateigröße pro Upload",
  passwordMinLength: "Passwort-Mindestlänge",
  passwordRequireUppercase: "Groß-/Kleinschreibung und Zahl erforderlich",
  passwordRequireLowercase: "Groß-/Kleinschreibung und Zahl erforderlich",
  passwordRequireNumber: "Groß-/Kleinschreibung und Zahl erforderlich",
  passwordRequireSpecialChar: "Sonderzeichen erforderlich",
  passwordExpiryDays: "Passwortwechsel nach Tagen",
  failedLoginLockoutThreshold: "Sperre nach Fehlversuchen",
  passwordBlockLeaked: "Bekannte geleakte Passwörter blockieren",
  passwordPreventReuseEnabled: "Letzte 5 Passwörter nicht erneut zulassen",
  allowTwoFactor: "2FA verfügbar machen",
  requireTwoFactorForAdmins: "Zwei-Faktor für Administratoren erzwingen",
  requireTwoFactorForAll: "Zwei-Faktor für alle Konten erzwingen",
  requireTwoFactorForPublishers:
    "Zwei-Faktor für Rollen mit Veröffentlichungsrecht",
  sessionIdleTimeoutMinutes: "Sitzungs-Timeout bei Inaktivität",
  defaultPageSize: "Einträge pro Seite",
  accentColor: "Akzentfarbe",
  tableDensity: "Tabellendichte",
  sidebarCollapsedByDefault: "Seitenleiste eingeklappt starten",
  keyboardShortcutsEnabled: "Tastaturkürzel aktiv",
  reduceMotion: "Bewegungen reduzieren",
  companyLogoUrl: "Firmenlogo",
  notifyMaintenanceMode: "Benachrichtigung „Wartungsmodus“",
  notifyStorageQuota: "Benachrichtigung „Speicherplatz fast voll“",
  notifyWebhookFailures: "Benachrichtigung „Fehlschlagende Webhooks“",
  notifyLocalDrafts: "Benachrichtigung „Lokale Entwürfe“",
  notifyPendingActivations: "Benachrichtigung „Wartende Freischaltungen“",
  notifyFailedLogins: "Benachrichtigung „Auffällige Fehlversuche“",
  notifyPendingPasswordChanges:
    "Benachrichtigung „Anstehende Passwortwechsel“",
  notifyCompanyIncomplete: "Benachrichtigung „Unvollständige Firmendaten“",
  notifyLegalDocuments: "Benachrichtigung „Veraltete/fehlende Rechtstexte“",
  notifyDeletionRequests: "Benachrichtigung „Offene Betroffenenanfragen“",
  notifyTrashExpiring: "Benachrichtigung „Papierkorb-Einträge laufen ab“",
  notificationRecipientEmail: "Benachrichtigungsempfänger",
  // Einstellungen → Integrationen, Karte "Dienste" (Nutzervorgabe,
  // 2026-08-22) – eigener Endpoint statt UpdateSettingsDto, daher kein
  // echtes before/after (siehe SettingsService.updateSmtpSettings()).
  emailSmtp: "E-Mail-Versand (SMTP)",
};

// Für Protokoll-Einträge, die kein Feld ändern, sondern eine Aktion sind
// (kein `metadata.field`, siehe `title`-Fallback unten) – ohne diese
// Zuordnung würde der rohe Action-String stehen (z.B.
// "settings.job_runs_deleted"). Bisher nur "Alle löschen" bei den
// Job-Läufen unter Einstellungen → Jobs (Nutzervorgabe, 2026-08-22:
// "letzte läufe alle löschen muss mit in das protokoll").
const ACTION_LABELS: Record<string, string> = {
  "settings.job_runs_deleted": "Job-Lauf-Historie gelöscht",
};

function humanizeField(field: string) {
  return FIELD_LABELS[field] ?? field.replace(/([a-z])([A-Z])/g, "$1 $2");
}

function formatValue(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "boolean") return value ? "aktiviert" : "deaktiviert";
  return String(value);
}

function describeSettingsChange(field: string, after: unknown): string {
  const label = humanizeField(field);
  if (typeof after === "boolean") {
    return `${label} ${after ? "aktiviert" : "deaktiviert"}`;
  }
  const formatted = formatValue(after);
  return formatted ? `${label} auf ${formatted} geändert` : `${label} geändert`;
}

/** "Protokoll"-Tab unter Einstellungen (Nutzervorgabe, 2026-08-22: "baue
 * protokolierung", 1:1 nach Bildvorlage) – gleiches Muster wie die
 * "Letzte Änderungen"-Karte auf der Firma-Seite (company-view.tsx),
 * aber mit echter Server-Pagination statt festem Limit=5, da hier über
 * die Zeit deutlich mehr Einträge zusammenkommen können. */
export function SettingsProtocolCard({
  changes,
}: {
  changes: SettingsChangesResponse | null;
}) {
  const router = useRouter();
  const items = changes?.items ?? [];
  const [deleteTarget, setDeleteTarget] = useState<SettingsChangeEntry | null>(
    null,
  );
  const [confirmAllOpen, setConfirmAllOpen] = useState(false);

  async function handleDelete() {
    if (!deleteTarget) return;
    await fetch(`/api/settings/changes/${deleteTarget.id}`, {
      method: "DELETE",
    });
    toastDeleted("Eintrag wurde gelöscht.");
    setDeleteTarget(null);
    router.refresh();
  }

  async function handleDeleteAll() {
    await fetch("/api/settings/changes", { method: "DELETE" });
    toastDeleted("Alle Einträge wurden gelöscht.");
    router.refresh();
  }

  return (
    <Card className="rounded-xl shadow-sm">
      <CardHeader>
        <CardTitle>Letzte Änderungen an den Einstellungen</CardTitle>
        <CardAction>
          <ConfirmDeleteDialog
            open={confirmAllOpen}
            onOpenChange={setConfirmAllOpen}
            trigger={
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="border-[#D4D4D4]"
                disabled={items.length === 0}
              >
                Alle löschen
              </Button>
            }
            title={`${changes?.meta.total ?? items.length} Einträge endgültig löschen?`}
            description="Diese Aktion kann nicht rückgängig gemacht werden."
            onConfirm={handleDeleteAll}
          />
        </CardAction>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Noch keine Änderungen erfasst.
          </p>
        ) : (
          <ol className="flex flex-col">
            {items.map((change, index) => {
              const field = change.metadata?.field ?? "";
              const title = field
                ? describeSettingsChange(field, change.metadata?.after)
                : (ACTION_LABELS[change.action] ?? change.action);
              const isLast = index === items.length - 1;
              return (
                <li key={change.id} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <span
                      className={
                        index === 0
                          ? "mt-1.5 size-2 shrink-0 rounded-full bg-primary"
                          : "mt-1.5 size-2 shrink-0 rounded-full bg-muted-foreground/30"
                      }
                    />
                    {!isLast && (
                      <span className="w-px flex-1 bg-neutral-300" />
                    )}
                  </div>
                  <div
                    className={`flex flex-1 items-start justify-between gap-2 ${isLast ? "pb-0" : "pb-4"}`}
                  >
                    <div>
                      <p className="text-sm font-medium">{title}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatName(change.user)} ·{" "}
                        {formatDate(change.createdAt)}
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon-sm"
                      className="rounded-lg border-[#D4D4D4] text-destructive hover:bg-destructive/5"
                      aria-label="Eintrag löschen"
                      onClick={() => setDeleteTarget(change)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
        {changes && (
          <PaginationControls
            page={changes.meta.page}
            pageCount={changes.meta.pageCount}
            buildHref={(p) => `?protocolPage=${p}`}
          />
        )}
      </CardContent>
      <ConfirmDeleteDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Eintrag endgültig löschen?"
        description="Diese Aktion kann nicht rückgängig gemacht werden."
        onConfirm={handleDelete}
      />
    </Card>
  );
}
