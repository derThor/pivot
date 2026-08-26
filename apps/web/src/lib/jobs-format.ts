// Einstellungen → "Jobs"-Reiter (Nutzervorgabe, 2026-08-22, 1:1 nach
// Bildvorlage). Reine Formatierungshelfer, geteilt zwischen
// `scheduled-jobs-card.tsx`/`recent-job-runs-card.tsx`.

export function formatRelativePast(iso: string | null): string {
  if (!iso) return "Noch nie";
  const date = new Date(iso);
  const diffMin = Math.round((Date.now() - date.getTime()) / 60000);
  if (diffMin < 1) return "gerade eben";
  if (diffMin < 60) return `vor ${diffMin} Min.`;
  const time = date.toLocaleTimeString("de-DE", {
    hour: "2-digit",
    minute: "2-digit",
  });
  if (date.toDateString() === new Date().toDateString()) {
    return `heute, ${time}`;
  }
  const dateStr = date.toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
  return `${dateStr}, ${time}`;
}

export function formatRelativeFuture(iso: string | null): string {
  if (!iso) return "–";
  const date = new Date(iso);
  const diffMs = date.getTime() - Date.now();
  if (diffMs <= 0) return "gleich";
  const diffMin = Math.round(diffMs / 60000);
  if (diffMin < 60) return `in ${diffMin} Min.`;
  const diffHours = Math.round(diffMin / 60);
  if (diffHours < 48) return `in ${diffHours} Std.`;
  const dateStr = date.toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
  });
  const time = date.toLocaleTimeString("de-DE", {
    hour: "2-digit",
    minute: "2-digit",
  });
  return `am ${dateStr}, ${time}`;
}

export function formatDuration(ms: number | null): string {
  if (ms == null) return "–";
  return `${(ms / 1000).toFixed(1).replace(".", ",")} s`;
}

export const RHYTHM_PRESETS: { label: string; cron: string }[] = [
  { label: "Jede Minute", cron: "* * * * *" },
  { label: "Alle 5 Minuten", cron: "*/5 * * * *" },
  { label: "Alle 15 Minuten", cron: "*/15 * * * *" },
  { label: "Stündlich", cron: "0 * * * *" },
  { label: "Täglich um 6:00", cron: "0 6 * * *" },
  { label: "Täglich um Mitternacht", cron: "0 0 * * *" },
  { label: "Monatlich am 1.", cron: "0 0 1 * *" },
];

export const CUSTOM_RHYTHM = "custom";

export function rhythmLabelForCron(cron: string): string {
  return (
    RHYTHM_PRESETS.find((p) => p.cron === cron)?.label ?? "Benutzerdefiniert"
  );
}
