"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { toastEdited } from "@/components/app-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SegmentedPicker } from "@/components/segmented-picker";
import type { WebsiteListItem } from "@/lib/api-server";

const MODE_OPTIONS: { value: "master" | "slave"; label: string }[] = [
  { value: "master", label: "Master" },
  { value: "slave", label: "Client" },
];

/** Popup für eine Mandanten-Zeile in `master-client-card.tsx` (Nutzervorgabe,
 * 2026-08-24, mehrfach wiederholt: "wenn ich unter Einstellung -
 * Master-Client - eine Seite anklicke, kommt ein Popup, wo man NUR wechseln
 * kann zwischen Master und Client. Mehr nicht.") – enthält bewusst nur den
 * Umschalter, kein Name/Domain/API-Key/Status (das bleibt unter
 * Administration → Webseite, `WebsiteDialog`). Speichert
 * `Website.deploymentMode` – ein rein dokumentarisches Feld ohne technische
 * Wirkung (siehe schema.prisma-Kommentar): der Master hat keinen
 * Push-Mechanismus, um den tatsächlichen Modus einer entfernten Installation
 * zu setzen, das stellt jede Installation nur für sich selbst ein. */
export function WebsiteModeDialog({
  target,
  onOpenChange,
  onSaved,
}: {
  target: WebsiteListItem | null;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<"master" | "slave">(
    target?.deploymentMode ?? "slave",
  );
  const [isSaving, setIsSaving] = useState(false);

  // Render-Zeit-Sync statt Effekt (gleiches Muster wie website-dialog.tsx):
  // bei jedem neuen Ziel den Modus neu befüllen.
  const [syncedTargetId, setSyncedTargetId] = useState(target?.id ?? null);
  if ((target?.id ?? null) !== syncedTargetId) {
    setSyncedTargetId(target?.id ?? null);
    if (target) setMode(target.deploymentMode);
  }

  const isDirty = target !== null && mode !== target.deploymentMode;

  async function handleSave() {
    if (!target) return;
    setIsSaving(true);
    try {
      const res = await fetch(`/api/websites/${target.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deploymentMode: mode }),
      });
      if (!res.ok) return;
      toastEdited("Modus gespeichert.");
      onOpenChange(false);
      onSaved();
      router.refresh();
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Dialog open={target !== null} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{target?.name}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <SegmentedPicker
            label="Modus"
            options={MODE_OPTIONS}
            value={mode}
            onChange={setMode}
          />
          {/* Nutzervorgabe, 2026-08-25: Version auch im Modus-Popup zeigen,
           * "immer in einem Badge, überall" statt reinem Fließtext. */}
          {target?.lastReportedVersion && (
            <Badge variant="outline" className="w-fit font-mono">
              Version {target.lastReportedVersion}
            </Badge>
          )}
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            className="border-[#D4D4D4]"
            onClick={() => onOpenChange(false)}
          >
            Abbrechen
          </Button>
          <Button
            type="button"
            disabled={!isDirty || isSaving}
            onClick={handleSave}
          >
            {isSaving ? "Speichert…" : "Speichern"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
