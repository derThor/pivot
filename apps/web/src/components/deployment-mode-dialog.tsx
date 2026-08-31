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
import type { AppSettings } from "@/lib/api-server";
import { bff } from "@/lib/bff";

const MODE_OPTIONS: { value: "master" | "slave"; label: string }[] = [
  { value: "master", label: "Master" },
  // Nutzervorgabe, 2026-08-24: "Slave" heißt in der UI "Client".
  { value: "slave", label: "Client" },
];

/** Popup für die "Diese Installation"-Zeile in `master-client-card.tsx`
 * (Nutzervorgabe, 2026-08-24: "dann soll ein Popup kommen, wo ich das von
 * Client zu Master und andersrum stellen kann") – ersetzt die vorherige
 * dauerhaft sichtbare "Bereitstellungsmodus"-Karte. Nur erreichbar, wenn
 * diese Installation aktuell Master ist (Nutzervorgabe: "das darf alles
 * nur auf dem Master erlaubt sein") – der Aufrufer (`master-client-card.tsx`)
 * rendert die klickbare Zeile nur in diesem Fall.
 *
 * Update 2026-08-24: enthält bewusst NUR den Modus-Umschalter, sonst
 * nichts ("hier unter Einstellungen soll nur Master oder Client
 * ausgewählt werden ... beim Umstellen soll nichts weiter passieren").
 * Die Wartungsseiten-Konfiguration (Titel/Text) lebt jetzt auf
 * `/dashboard/websites` (`maintenance-page-card.tsx`), da diese Seite
 * – anders als dieser Master-exklusive Reiter – auch auf einer Client-
 * Installation erreichbar bleibt. */
export function DeploymentModeDialog({
  open,
  onOpenChange,
  settings,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  settings: AppSettings;
}) {
  const router = useRouter();
  const [mode, setMode] = useState(settings.deploymentMode);
  const [isSaving, setIsSaving] = useState(false);

  // Render-Zeit-Sync statt Effekt (gleiches Muster wie website-dialog.tsx):
  // bei jedem erneuten Öffnen den Modus aus den aktuellen Einstellungen
  // neu befüllen.
  const [syncedOpen, setSyncedOpen] = useState(open);
  if (open !== syncedOpen) {
    setSyncedOpen(open);
    if (open) setMode(settings.deploymentMode);
  }

  const isDirty = mode !== settings.deploymentMode;

  async function handleSave() {
    setIsSaving(true);
    try {
      const res = await fetch(bff("/api/settings"), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deploymentMode: mode }),
      });
      if (!res.ok) return;
      toastEdited("Bereitstellungsmodus gespeichert.");
      onOpenChange(false);
      router.refresh();
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Diese Installation</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <SegmentedPicker
            label="Modus"
            options={MODE_OPTIONS}
            value={mode}
            onChange={setMode}
          />
          <p className="text-xs text-muted-foreground">
            Master verwaltet ausgelieferte Installationen, Client prüft
            wöchentlich bei einem Master.
          </p>
          {/* Nutzervorgabe, 2026-08-25: Version auch im Modus-Popup zeigen,
           * "immer in einem Badge, überall" statt reinem Fließtext. */}
          {settings.appVersion && (
            <Badge
              variant="secondary"
              className="badge--amber w-fit border-0 font-mono"
            >
              Version {settings.appVersion}
            </Badge>
          )}
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            className="border-button-border"
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
