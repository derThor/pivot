"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { toastEdited } from "@/components/app-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SwitchRow } from "@/components/switch-row";
import type { AppSettings } from "@/lib/api-server";
import { bff } from "@/lib/bff";

type NotifyKey =
  | "notifyMaintenanceMode"
  | "notifyStorageQuota"
  | "notifyWebhookFailures"
  | "notifyPendingActivations"
  | "notifyFailedLogins"
  | "notifyPendingPasswordChanges"
  | "notifyCompanyIncomplete"
  | "notifyLegalDocuments"
  | "notifyDeletionRequests"
  | "notifyTrashExpiring";

const ROWS: { key: NotifyKey; label: string; description: string }[] = [
  {
    key: "notifyMaintenanceMode",
    label: "Wartungsmodus",
    description:
      "Zeigt einen Hinweis im Dashboard, dass die Website aktuell im Wartungsmodus ist.",
  },
  {
    key: "notifyStorageQuota",
    label: "Speicherplatz fast voll",
    description:
      "Warnt, wenn das Speicherkontingent für Medien fast ausgeschöpft ist.",
  },
  {
    key: "notifyWebhookFailures",
    label: "Fehlschlagende Webhooks",
    description: "Warnt, wenn ein Webhook wiederholt fehlschlägt.",
  },
  {
    key: "notifyPendingActivations",
    label: "Wartende Freischaltungen",
    description:
      "Zeigt an, wenn neu registrierte Konten auf eine Admin-Freischaltung warten.",
  },
  {
    key: "notifyFailedLogins",
    label: "Auffällige Fehlversuche",
    description:
      "Warnt bei auffällig vielen fehlgeschlagenen Login-Versuchen in Folge.",
  },
  {
    key: "notifyPendingPasswordChanges",
    label: "Anstehende Passwortwechsel",
    description: "Weist auf Konten hin, deren Passwort in Kürze abläuft.",
  },
  {
    key: "notifyCompanyIncomplete",
    label: "Unvollständige Firmendaten",
    description:
      "Weist auf fehlende Pflichtangaben in den Firmen-Stammdaten hin.",
  },
  {
    key: "notifyLegalDocuments",
    label: "Veraltete/fehlende Rechtstexte",
    description: "Weist auf veraltete oder fehlende Rechtstexte hin.",
  },
  {
    key: "notifyDeletionRequests",
    label: "Offene Betroffenenanfragen",
    description:
      "Zeigt offene DSGVO-Anfragen (Löschung/Auskunft/Berichtigung) an.",
  },
  {
    key: "notifyTrashExpiring",
    label: "Papierkorb-Einträge laufen ab",
    description:
      "Warnt, wenn Papierkorb-Einträge bald für die Wiederherstellung gesperrt werden.",
  },
];

/** Ein-/Ausschalter je Systembenachrichtigung-Kategorie (Nutzervorgabe,
 * 2026-08-16) – schaltet nur, OB die Kategorie als Banner/Glocken-Zähler
 * auftaucht, nicht den zugrunde liegenden Zustand selbst (z.B. bleibt der
 * Wartungsmodus aktiv, auch wenn die Benachrichtigung dazu ausgeblendet
 * ist). Bewusst weiterhin Instant-Save je Zeile statt Teil des großen
 * Speichern/Verwerfen-Formulars in `settings-form.tsx` (Nutzervorgabe,
 * 2026-08-21: von Systemnachrichten hierher verschoben, Instant-Save-
 * Verhalten dabei unverändert übernommen).
 *
 * `notifyLocalDrafts` bewusst NICHT mehr hier gelistet (Nutzer-Bugreport,
 * gleicher Tag: Glocke zeigte mehr an als das Postfach enthielt) – das
 * Feld wirkt seit dem Umbau auf ein echtes, serverseitiges Postfach
 * (siehe toast-and-system-messages.md) nirgends mehr: lokale Entwürfe
 * sind rein browserlokal und können nie eine `Notification`-Zeile werden,
 * die Glocke zählt seither ausschließlich `Notification.isRead`. Der
 * Schalter wäre hier wirkungslos gewesen. `AppSettings.notifyLocalDrafts`
 * existiert als DB-Feld weiterhin (kein Migrationsschritt nötig), hat nur
 * keinen Leser mehr. */
export function NotificationSettingsCard({
  settings,
}: {
  settings: Pick<AppSettings, NotifyKey | "notificationRecipientEmail">;
}) {
  const router = useRouter();
  const [values, setValues] = useState(settings);
  const [pendingKey, setPendingKey] = useState<NotifyKey | null>(null);
  const [recipientEmail, setRecipientEmail] = useState(
    settings.notificationRecipientEmail ?? "",
  );
  const [isSavingRecipient, setIsSavingRecipient] = useState(false);
  const savedRecipientEmail = settings.notificationRecipientEmail ?? "";

  async function handleToggle(key: NotifyKey, next: boolean) {
    setValues((prev) => ({ ...prev, [key]: next }));
    setPendingKey(key);
    try {
      await fetch(bff("/api/settings"), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [key]: next }),
      });
      router.refresh();
    } finally {
      setPendingKey(null);
    }
  }

  async function handleSaveRecipient() {
    setIsSavingRecipient(true);
    try {
      await fetch(bff("/api/settings"), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          notificationRecipientEmail: recipientEmail.trim() || null,
        }),
      });
      toastEdited("Benachrichtigungsempfänger wurde gespeichert.");
      router.refresh();
    } finally {
      setIsSavingRecipient(false);
    }
  }

  return (
    <Card className="rounded-xl shadow-sm">
      <CardHeader>
        <CardTitle>Benachrichtigungen</CardTitle>
        <p className="text-sm text-muted-foreground">
          Steuert, welche Systembenachrichtigungen im Dashboard erscheinen und
          zusätzlich per E-Mail gehen.
        </p>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-col gap-2 border-b border-border pb-4">
          <Label htmlFor="notification-recipient">
            Benachrichtigungsempfänger
          </Label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              id="notification-recipient"
              type="email"
              placeholder="z.B. admin@example.de"
              value={recipientEmail}
              onChange={(e) => setRecipientEmail(e.target.value)}
            />
            <Button
              type="button"
              variant="outline"
              className="shrink-0 border-border"
              disabled={
                isSavingRecipient || recipientEmail === savedRecipientEmail
              }
              onClick={handleSaveRecipient}
            >
              {isSavingRecipient ? "Speichert…" : "Speichern"}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Aktivierte Kategorien unten werden zusätzlich sofort bei jedem neuen
            Vorfall an diese Adresse gemailt (setzt einen eingerichteten Dienst
            unter Integrationen → Dienste voraus). Leer lassen für keine
            E-Mail-Zustellung.
          </p>
        </div>
        {ROWS.map((row) => (
          <SwitchRow
            key={row.key}
            label={row.label}
            description={row.description}
            checked={values[row.key]}
            disabled={pendingKey === row.key}
            onCheckedChange={(next) => handleToggle(row.key, next)}
          />
        ))}
      </CardContent>
    </Card>
  );
}
