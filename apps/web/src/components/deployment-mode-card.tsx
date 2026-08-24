"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { toastEdited } from "@/components/app-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SegmentedPicker } from "@/components/segmented-picker";
import type { AppSettings } from "@/lib/api-server";

const MODE_OPTIONS: { value: "master" | "slave"; label: string }[] = [
  { value: "master", label: "Master" },
  // Nutzervorgabe: "Slave" heißt in der UI "Client".
  { value: "slave", label: "Client" },
];

/** Einstellungen → Master-Client (Nutzervorgabe, 2026-08-24: "unter
 * Einstellung soll nur Client oder Master gesetzt werden, alles andere
 * in Webseiten") – bewusst NUR der Modus-Umschalter, keine Mandanten-
 * Liste, kein Popup, keine Wartungsseiten-Felder. Die Mandanten-
 * Verwaltung lebt vollständig auf `/dashboard/websites`
 * (`websites-view.tsx`), die Wartungsseiten-Konfiguration dort in
 * `maintenance-page-card.tsx`. */
export function DeploymentModeCard({ settings }: { settings: AppSettings }) {
  const router = useRouter();
  const [mode, setMode] = useState(settings.deploymentMode);
  const [isSaving, setIsSaving] = useState(false);

  const isDirty = mode !== settings.deploymentMode;

  async function handleSave() {
    setIsSaving(true);
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deploymentMode: mode }),
      });
      if (!res.ok) return;
      toastEdited("Bereitstellungsmodus gespeichert.");
      router.refresh();
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Card className="rounded-xl shadow-sm">
      <CardHeader>
        <CardTitle>Master-Client</CardTitle>
        <p className="text-sm text-muted-foreground">
          Master verwaltet ausgelieferte Installationen, Client prüft
          wöchentlich bei einem Master.
        </p>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <SegmentedPicker
          label="Modus"
          options={MODE_OPTIONS}
          value={mode}
          onChange={setMode}
        />
        <Button
          type="button"
          disabled={!isDirty || isSaving}
          onClick={handleSave}
          className="self-start"
        >
          {isSaving ? "Speichert…" : "Speichern"}
        </Button>
      </CardContent>
    </Card>
  );
}
