"use client";

import { Check, X } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatRelativeTime } from "@/lib/utils";
import { WEBSITE_STATUS_BADGE } from "@/lib/website-status";
import type { WebsiteListItem } from "@/lib/api-server";

/** Info-Popup zum "Prüfen"-Ergebnis einer Website (Nutzervorgabe,
 * 2026-08-25: "machst in der Kachel selber nur einen Alert, das Prüfung OK
 * oder nicht OK ... dann ein Info-Icon, wo man ein Popup aufrufen kann mit
 * der eigentlichen Prüfung") – die Kachel selbst zeigt nur eine knappe
 * OK/Hinweis-Zeile (siehe websites-view.tsx), die einzelnen Teilergebnisse
 * (`lastCheckChecks`) landen ausschließlich hier. */
export function WebsiteCheckDetailsDialog({
  target,
  onOpenChange,
}: {
  target: WebsiteListItem | null;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={target !== null} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Prüfergebnis „{target?.name}“</DialogTitle>
        </DialogHeader>
        {target && (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-muted-foreground">
              {target.lastWakeupAt
                ? `Zuletzt geprüft ${formatRelativeTime(target.lastWakeupAt)}`
                : "Noch nicht geprüft."}
            </p>
            {/* Nutzervorgabe, 2026-08-25: Version "immer in einem Badge,
             * überall" – auch hier neben der "Version aktuell"-Zeile unten. */}
            {target.lastReportedVersion && (
              <Badge
                variant="secondary"
                className="badge--amber w-fit border-0 font-mono"
              >
                Version {target.lastReportedVersion}
              </Badge>
            )}
            {target.lastCheckChecks && target.lastCheckChecks.length > 0 && (
              <div className="flex flex-col gap-2">
                {target.lastCheckChecks.map((check, index) => (
                  <div key={index} className="flex items-center gap-2 text-sm">
                    {check.ok ? (
                      <Check className="size-4 shrink-0 text-green-600" />
                    ) : (
                      <X className="size-4 shrink-0 text-red-600" />
                    )}
                    <span>{check.label}</span>
                  </div>
                ))}
              </div>
            )}
            {/* Nutzervorgabe, 2026-08-25: statt des rohen "Status: live."-
             * Freitexts einen echten Status-Badge zeigen. Die Rohmeldung
             * bleibt nur sichtbar, wenn (noch) kein bestätigter Status
             * vorliegt (z.B. bei einem Fehlschlag). */}
            {target.lastReportedLicenseStatus ? (
              <Badge
                variant="secondary"
                className={
                  WEBSITE_STATUS_BADGE[target.lastReportedLicenseStatus]
                    .className
                }
              >
                Status:{" "}
                {WEBSITE_STATUS_BADGE[target.lastReportedLicenseStatus].label}
              </Badge>
            ) : (
              target.lastWakeupMessage && (
                <p className="rounded-lg bg-muted p-3 text-sm text-muted-foreground">
                  {target.lastWakeupMessage}
                </p>
              )
            )}
          </div>
        )}
        <DialogFooter>
          <Button type="button" onClick={() => onOpenChange(false)}>
            Fertig
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
