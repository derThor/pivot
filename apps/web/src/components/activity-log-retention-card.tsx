"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SegmentedPicker } from "@/components/segmented-picker";
import { bff } from "@/lib/bff";

/** "Jobs"-Reiter unter Einstellungen (Nutzervorgabe, 2026-08-30: "bitte
 * auch noch den aktivitäten history über sowas regeln. mache eine
 * weitere einstellung unter einstellungen und jobs"). Räumt den
 * kompletten, geteilten `AuditLog` auf – Aktivität-Tab, Einstellungen-
 * Protokoll UND Datenschutz-Zugriffsprotokoll sind dieselbe Tabelle
 * (siehe privacy-view.tsx) – ersetzt damit nach Rückfrage bewusst die
 * bisherige rein manuelle Zugriffsprotokoll-Löschliste durch eine harte
 * automatische Obergrenze. Gleiches Muster wie JobRunRetentionCard. */
export function ActivityLogRetentionCard({
  activityLogRetentionDays,
}: {
  activityLogRetentionDays: number | null;
}) {
  const router = useRouter();
  const [retentionDays, setRetentionDays] = useState(activityLogRetentionDays);

  async function handleChange(value: number) {
    const next = value === -1 ? null : value;
    setRetentionDays(next);
    await fetch(bff("/api/settings"), {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ activityLogRetentionDays: next }),
    });
    router.refresh();
  }

  return (
    <Card className="rounded-xl shadow-sm">
      <CardHeader>
        <CardTitle>Aktivitäten-Historie aufbewahren</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
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
          Läuft täglich über den kompletten Audit-Log hinweg – betrifft den
          Aktivität-Tab, das Einstellungen-Protokoll und das
          Datenschutz-Zugriffsprotokoll gleichermaßen, da alle dieselbe Historie
          teilen.
        </p>
      </CardContent>
    </Card>
  );
}
