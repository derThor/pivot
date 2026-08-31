"use client";

import { useState } from "react";
import { Download } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { bff } from "@/lib/bff";

function ExportRow({
  title,
  note,
  onExport,
  disabled,
  isExporting,
}: {
  title: string;
  note: string;
  onExport?: () => void;
  disabled?: boolean;
  isExporting?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border border-border bg-muted p-4">
      <div className="flex flex-col gap-0.5">
        <p className="text-sm font-medium">{title}</p>
        <p className="text-sm text-muted-foreground">{note}</p>
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="border-button-border"
        onClick={onExport}
        disabled={disabled || isExporting}
      >
        <Download className="size-4" />
        {isExporting ? "Exportiert…" : "Export"}
      </Button>
    </div>
  );
}

/** "Export & Sicherung" (Nutzervorgabe, 2026-08-22: "export soll so
 * aussehen", 1:1 nach Bildvorlage: Zeilen mit Titel/Untertitel links,
 * Export-Button rechts). "Zugriffsprotokoll (CSV)" (der Änderungs-Export
 * aus SettingsProtocolCard, hierher verschoben statt im Karten-Header,
 * siehe Nutzerkorrektur zum selben Zeitpunkt) und "Einstellungen als JSON"
 * (Nutzervorgabe, 2026-08-22: "umsetzen") sind echt – "Vollständiger
 * Inhaltsexport" bleibt bewusst deaktiviert, da Formular-Einsendungen kein
 * reales Feature dieser App sind (kein erfundener Inhalt, siehe
 * PROCESS.md-Prinzip). */
export function SettingsExportCard({ hasChanges }: { hasChanges: boolean }) {
  const [isExporting, setIsExporting] = useState(false);
  const [isExportingJson, setIsExportingJson] = useState(false);

  async function handleExportChanges() {
    setIsExporting(true);
    try {
      const res = await fetch(bff("/api/settings/changes/export"));
      if (!res.ok) return;
      // `res.blob()` statt `res.text()`: `text()` entfernt laut WHATWG-Spec
      // ein führendes UTF-8-BOM beim Dekodieren, Excel zeigt Umlaute dann
      // als Mojibake (gleicher Bug-Typ wie beim DSGVO-Bericht).
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `einstellungen-protokoll-${new Date().toISOString().slice(0, 10)}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    } finally {
      setIsExporting(false);
    }
  }

  async function handleExportJson() {
    setIsExportingJson(true);
    try {
      const res = await fetch(bff("/api/settings/export"));
      if (!res.ok) return;
      const data = await res.json();
      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `einstellungen-${new Date().toISOString().slice(0, 10)}.json`;
      link.click();
      URL.revokeObjectURL(url);
    } finally {
      setIsExportingJson(false);
    }
  }

  return (
    <Card className="rounded-xl shadow-sm">
      <CardHeader>
        <CardTitle>Export & Sicherung</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <ExportRow
          title="Einstellungen als JSON"
          note="Vollständiger Export aller allgemeinen Einstellungen als JSON-Datei."
          onExport={handleExportJson}
          isExporting={isExportingJson}
        />
        <ExportRow
          title="Vollständiger Inhaltsexport"
          note="Ist aktuell nicht geplant, da Formular-Einsendungen kein reales Feature dieser App sind."
          disabled
        />
        <ExportRow
          title="Zugriffsprotokoll (CSV)"
          note="Komplette Änderungshistorie der Einstellungen (siehe oben)."
          onExport={handleExportChanges}
          disabled={!hasChanges}
          isExporting={isExporting}
        />
      </CardContent>
    </Card>
  );
}
