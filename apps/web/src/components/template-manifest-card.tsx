"use client";

import { useState } from "react";
import { Pencil, RotateCcw } from "lucide-react";
import type { TemplateManifest } from "@pivot/blocks";

import { TemplateManifestDialog } from "@/components/template-manifest-dialog";
import { SystemMessage } from "@/components/ui/system-message";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

/**
 * Das Manifest des EINGEBAUTEN Templates (die Datei im Frontend-Projekt)
 * hier zu übersteuern, ohne es neu zu deployen.
 *
 * Seit 2026-09-05 nur noch die Hülle um den gemeinsamen Editor-Dialog –
 * vorher stand hier ein eigenes JSON-Textfeld. Hochgeladene Templates
 * benutzen denselben Dialog, gespeichert wird nur woanders
 * (Nutzervorgabe: *"das jedes manifest dynamisch bearbeitet werden kann in
 * der ui"*).
 */
export function TemplateManifestCard({
  value,
  onChange,
}: {
  value: TemplateManifest | null;
  onChange: (next: TemplateManifest | null) => void;
}) {
  const [note, setNote] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-3 sm:col-span-2">
      <div className="flex flex-col gap-1">
        <Label>Manifest des eingebauten Templates</Label>
        <p className="text-sm text-muted-foreground">
          {value
            ? "Es gilt das hier hinterlegte Manifest – es sticht die Datei des Frontend-Projekts."
            : "Es gilt die Manifest-Datei des Frontend-Projekts. Ein hier hinterlegtes Manifest würde sie stechen."}{" "}
          Ist ein hochgeladenes Template aktiv, zählt dessen eigenes Manifest.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <TemplateManifestDialog
          title="Manifest des eingebauten Templates"
          manifest={value}
          onSave={async (next) => {
            onChange(next);
            setNote(
              "Übernommen. Wirksam wird es mit dem Speichern der Einstellungen.",
            );
            return null;
          }}
          trigger={
            <Button
              type="button"
              variant="outline"
              className="border-button-border"
            >
              <Pencil className="size-4" />
              Manifest bearbeiten
            </Button>
          }
        />
        {value && (
          <Button
            type="button"
            variant="outline"
            className="border-button-border"
            onClick={() => {
              onChange(null);
              setNote(
                "Zurückgesetzt: es gilt wieder die Manifest-Datei des Templates. Wirksam mit dem Speichern.",
              );
            }}
          >
            <RotateCcw className="size-4" />
            Auf Template-Datei zurücksetzen
          </Button>
        )}
      </div>

      {note && (
        <SystemMessage variant="info" title="Hinweis" description={note} />
      )}

      <p className="text-xs text-muted-foreground">
        Ein Manifest beschreibt Felder und Bereiche – es gibt dem Template keine
        neuen Fähigkeiten. Ein Feld auf eine CSS-Variable, die das Template
        nicht benutzt, bleibt wirkungslos; ein Bereich, den es nicht rendert,
        erscheint nicht.
      </p>
    </div>
  );
}
