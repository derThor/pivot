"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SegmentedPicker } from "@/components/segmented-picker";
import { SwitchRow } from "@/components/switch-row";

/** "Jobs"-Reiter unter Einstellungen, ganz oben auf der Seite
 * (Nutzervorgabe, 2026-08-30: "setze das am anfang der seite" – vorher
 * unten in RecentJobRunsCard). Eigene, schlanke Karte statt Teil von
 * "Letzte Läufe", da die Aufbewahrungsfrist eine Job-weite Einstellung
 * ist, keine Eigenschaft der Lauf-Historie selbst. "Alle Jobs pausieren"
 * ist ebenfalls hierher gewandert (Nutzervorgabe, 2026-08-30: "alle jobs
 * pausieren ganz am anfang der seite in die kachel job lauf historie
 * aufbewahren") – beides sind job-weite Einstellungen, keine Eigenschaft
 * der Lauf-Historie-Liste selbst. */
export function JobRunRetentionCard({
  jobRunRetentionDays,
  jobsGloballyPaused,
}: {
  jobRunRetentionDays: number | null;
  jobsGloballyPaused: boolean;
}) {
  const router = useRouter();
  const [retentionDays, setRetentionDays] = useState(jobRunRetentionDays);
  const [globallyPaused, setGloballyPaused] = useState(jobsGloballyPaused);
  const [isSavingPause, setIsSavingPause] = useState(false);

  async function handleChange(value: number) {
    const next = value === -1 ? null : value;
    setRetentionDays(next);
    await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jobRunRetentionDays: next }),
    });
    router.refresh();
  }

  async function handleToggleGlobalPause(checked: boolean) {
    setGloballyPaused(checked);
    setIsSavingPause(true);
    try {
      await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobsGloballyPaused: checked }),
      });
      router.refresh();
    } finally {
      setIsSavingPause(false);
    }
  }

  return (
    <Card className="rounded-xl shadow-sm">
      <CardHeader>
        <CardTitle>Job-Lauf-Historie aufbewahren</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <SegmentedPicker
            value={retentionDays ?? -1}
            onChange={handleChange}
            options={[
              { label: "30 Tage", value: 30 },
              { label: "90 Tage", value: 90 },
              { label: "1 Jahr", value: 365 },
              { label: "unbegrenzt", value: -1 },
            ]}
          />
          <p className="text-xs text-muted-foreground">
            Läuft täglich über alle Jobs hinweg, inklusive der
            Live-Überwachung gesperrter Websites.
          </p>
        </div>
        <SwitchRow
          label="Alle Jobs pausieren"
          description="Nichts läuft automatisch, bis wieder aktiviert – kritische Jobs ausgenommen."
          checked={globallyPaused}
          disabled={isSavingPause}
          onCheckedChange={handleToggleGlobalPause}
        />
      </CardContent>
    </Card>
  );
}
