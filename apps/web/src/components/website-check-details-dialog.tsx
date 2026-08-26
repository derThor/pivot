"use client";

import { AlertTriangle, CheckCircle2, Info, RotateCcw, X } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn, formatRelativeTime } from "@/lib/utils";
import { WEBSITE_STATUS_BADGE } from "@/lib/website-status";
import type { WebsiteListItem } from "@/lib/api-server";

// Nutzervorgabe, 2026-08-26: exakte Farben nach Bildvorlage – dieselben
// Werte wie ui/system-message.tsx' "warning"/"success"-Varianten, hier
// separat gepflegt, da diese Komponente den Header-Bereich (Fläche +
// Icon-Box + Titel/Untertitel) individuell aufbaut statt SystemMessage
// direkt zu verwenden.
const HEADER_STYLES = {
  warning: {
    header:
      "bg-[#fffbeb] border-[#fde68a] dark:bg-[#3d2f10] dark:border-[#6b5220]",
    icon: "text-[#b45309] dark:text-[#f6cf7e]",
    title: "text-[#78350f] dark:text-[#f8e6bd]",
    subtitle: "text-[#78350f]/70 dark:text-[#f8e6bd]/70",
  },
  success: {
    header:
      "bg-[#f0fdf4] border-[#bbf7d0] dark:bg-[#1b3b2a] dark:border-[#2f6a4d]",
    icon: "text-[#15803d] dark:text-[#8df0b4]",
    title: "text-[#14532d] dark:text-[#d7f5e3]",
    subtitle: "text-[#14532d]/70 dark:text-[#d7f5e3]/70",
  },
  // Website wurde noch nie geprüft (kein `lastWakeupAt`) – graue Variante,
  // dieselben Farben wie `SystemMessage`s "neutral".
  neutral: {
    header: "border-border bg-muted/60",
    icon: "text-muted-foreground",
    title: "text-foreground",
    subtitle: "text-muted-foreground",
  },
} as const;

function formatCheckedAt(iso: string) {
  const date = new Date(iso);
  const now = new Date();
  if (now.getTime() - date.getTime() < 60_000) return "gerade eben";
  if (date.toDateString() === now.toDateString()) {
    return `${date.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })} Uhr`;
  }
  return date.toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

/** Info-Popup zum "Prüfen"-Ergebnis einer Website (Nutzervorgabe,
 * 2026-08-26, 1:1 nach Bildvorlage): farbiger Kopfbereich (Status +
 * Domain + Zeitpunkt), Version-/Status-Badges, Prüfpunkte mit
 * rechtsbündigem Detail-Wert (echte, vom Backend gemessene/verglichene
 * Werte, siehe websites.service.ts `performWakeup()` – keine erfundenen
 * Daten), Footer mit Bestanden-Zähler + "Erneut prüfen"/"Schließen". */
export function WebsiteCheckDetailsDialog({
  target,
  onOpenChange,
  onRecheck,
  isRechecking,
}: {
  target: WebsiteListItem | null;
  onOpenChange: (open: boolean) => void;
  onRecheck: (website: WebsiteListItem) => void;
  isRechecking: boolean;
}) {
  const checks = target?.lastCheckChecks ?? [];
  const passedCount = checks.filter((c) => c.ok).length;
  const status =
    !target || !target.lastWakeupAt
      ? "neutral"
      : target.lastWakeupOk
        ? "success"
        : "warning";
  const styles = HEADER_STYLES[status];

  return (
    <Dialog open={target !== null} onOpenChange={onOpenChange}>
      <DialogContent
        className="gap-0 overflow-hidden p-0 sm:max-w-lg"
        showCloseButton={false}
      >
        <DialogTitle className="sr-only">
          Prüfergebnis „{target?.name}“
        </DialogTitle>
        {target && (
          <>
            <div
              className={cn(
                "flex items-start gap-3 border-b p-5",
                styles.header,
              )}
            >
              <span
                className={cn(
                  "flex size-9 shrink-0 items-center justify-center rounded-lg bg-card shadow-sm",
                  styles.icon,
                )}
              >
                {status === "neutral" ? (
                  <Info className="size-[18px]" />
                ) : status === "success" ? (
                  <CheckCircle2 className="size-[18px]" />
                ) : (
                  <AlertTriangle className="size-[18px]" />
                )}
              </span>
              <div className="min-w-0 flex-1 pt-0.5">
                <p className={cn("font-semibold", styles.title)}>
                  {status === "neutral"
                    ? "Noch nie geprüft"
                    : status === "success"
                      ? "Alles in Ordnung"
                      : "Mit Hinweisen"}
                </p>
                <p className={cn("truncate text-sm", styles.subtitle)}>
                  {target.domain}
                  {target.lastWakeupAt &&
                    ` · geprüft ${formatCheckedAt(target.lastWakeupAt)}`}
                </p>
              </div>
              <button
                type="button"
                aria-label="Schließen"
                onClick={() => onOpenChange(false)}
                className={cn(
                  "shrink-0 rounded-md p-1 transition-opacity hover:opacity-70",
                  styles.title,
                )}
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="flex flex-col gap-4 p-5">
              <p className="text-sm text-muted-foreground">
                {target.lastCheckInAt
                  ? `Zuletzt selbst gemeldet ${formatRelativeTime(target.lastCheckInAt)}`
                  : "Hat sich noch nie selbst gemeldet"}
              </p>

              <div className="flex flex-wrap gap-2">
                {target.lastReportedVersion && (
                  <Badge className="badge--slate border-0 font-mono">
                    Pivot {target.lastReportedVersion}
                  </Badge>
                )}
                <Badge
                  className={WEBSITE_STATUS_BADGE[target.status].className}
                >
                  {WEBSITE_STATUS_BADGE[target.status].label}
                </Badge>
              </div>

              {checks.length > 0 ? (
                <div className="flex flex-col divide-y divide-border">
                  {checks.map((check, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between gap-4 px-3 py-2.5 text-sm"
                    >
                      <span className="flex items-center gap-2">
                        {check.ok ? (
                          <CheckCircle2 className="size-4 shrink-0 text-[#15803d] dark:text-[#8df0b4]" />
                        ) : (
                          <AlertTriangle className="size-4 shrink-0 text-[#b45309] dark:text-[#f6cf7e]" />
                        )}
                        {check.label}
                      </span>
                      <span className="shrink-0 text-muted-foreground">
                        {check.detail ?? "–"}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                target.lastWakeupMessage && (
                  <p className="rounded-lg bg-muted p-3 text-sm text-muted-foreground">
                    {target.lastWakeupMessage}
                  </p>
                )
              )}
            </div>

            <DialogFooter className="m-0 flex-col items-stretch gap-3 rounded-b-xl border-t bg-transparent px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
              {checks.length > 0 && (
                <p className="text-sm text-muted-foreground sm:shrink-0 sm:whitespace-nowrap">
                  {passedCount} von {checks.length} Prüfungen bestanden
                </p>
              )}
              <div className="flex gap-2 sm:ml-auto sm:shrink-0">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1 border-border sm:flex-none"
                  disabled={isRechecking}
                  onClick={() => onRecheck(target)}
                >
                  <RotateCcw />
                  {isRechecking ? "Prüft…" : "Erneut prüfen"}
                </Button>
                <Button
                  type="button"
                  className="flex-1 sm:flex-none"
                  onClick={() => onOpenChange(false)}
                >
                  Schließen
                </Button>
              </div>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
