"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Switch } from "@/components/ui/switch";
import type { AppSettings } from "@/lib/api-server";

type NotifyKey =
  | "notifyMaintenanceMode"
  | "notifyStorageQuota"
  | "notifyWebhookFailures"
  | "notifyLocalDrafts"
  | "notifyPendingActivations"
  | "notifyFailedLogins"
  | "notifyPendingPasswordChanges";

const ROWS: { key: NotifyKey; label: string }[] = [
  { key: "notifyMaintenanceMode", label: "Wartungsmodus" },
  { key: "notifyStorageQuota", label: "Speicherplatz fast voll" },
  { key: "notifyWebhookFailures", label: "Fehlschlagende Webhooks" },
  { key: "notifyLocalDrafts", label: "Nicht gespeicherte Entwürfe" },
  { key: "notifyPendingActivations", label: "Wartende Freischaltungen" },
  { key: "notifyFailedLogins", label: "Auffällige Fehlversuche" },
  { key: "notifyPendingPasswordChanges", label: "Anstehende Passwortwechsel" },
];

// Ein-/Ausschalter je Systembenachrichtigung-Kategorie (Nutzervorgabe,
// 2026-08-16) – schaltet nur, OB die Kategorie als Banner/Glocken-Zähler
// auftaucht, nicht den zugrunde liegenden Zustand selbst (z.B. bleibt der
// Wartungsmodus aktiv, auch wenn die Benachrichtigung dazu ausgeblendet ist).
export function NotificationSettingsCard({
  settings,
}: {
  settings: Pick<AppSettings, NotifyKey>;
}) {
  const router = useRouter();
  const [values, setValues] = useState(settings);
  const [pendingKey, setPendingKey] = useState<NotifyKey | null>(null);

  async function handleToggle(key: NotifyKey, next: boolean) {
    setValues((prev) => ({ ...prev, [key]: next }));
    setPendingKey(key);
    try {
      await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [key]: next }),
      });
      router.refresh();
    } finally {
      setPendingKey(null);
    }
  }

  return (
    <div className="flex h-fit flex-col gap-1 rounded-xl border border-[#E5E5E5] bg-card shadow-sm p-6">
      <h2 className="mb-2 font-semibold">Benachrichtigungen</h2>
      <div className="flex flex-col divide-y divide-[#F0F0F0]">
        {ROWS.map((row) => (
          <div
            key={row.key}
            className="flex items-center justify-between gap-3 py-3"
          >
            <span className="text-sm">{row.label}</span>
            <Switch
              checked={values[row.key]}
              disabled={pendingKey === row.key}
              onCheckedChange={(next) => handleToggle(row.key, next)}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
