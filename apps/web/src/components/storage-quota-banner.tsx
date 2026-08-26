import { SystemMessage } from "@/components/ui/system-message";
import type { MediaStorageUsage } from "@/lib/api-server";

// Ab diesem Auslastungsgrad erscheint der Hinweis (Nutzervorgabe, 2026-08-15).
// Exportiert, damit `dashboard/layout.tsx` denselben Schwellenwert für den
// Glocken-Badge-Zähler nutzt statt ihn ein zweites Mal zu pflegen.
export const STORAGE_WARNING_THRESHOLD_PERCENT = 90;

function formatBytes(bytes: number) {
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(0)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
}

export function StorageQuotaBanner({
  usage,
}: {
  usage: MediaStorageUsage | null;
}) {
  if (
    usage?.percentUsed == null ||
    usage.percentUsed < STORAGE_WARNING_THRESHOLD_PERCENT
  ) {
    return null;
  }

  return (
    <SystemMessage
      variant="warning"
      title="Speicher fast voll"
      description={`Dein Medien-Kontingent ist zu ${Math.round(usage.percentUsed)} % ausgelastet (${formatBytes(usage.usedBytes)} von ${usage.quotaMb ? formatBytes(usage.quotaMb * 1024 * 1024) : "?"}). Bitte alte Dateien entfernen.`}
    />
  );
}
