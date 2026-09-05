"use client";

import { useRef, useState } from "react";
import { FileJson, RotateCcw, Sparkles, Upload } from "lucide-react";
import {
  validateTemplateManifest,
  type TemplateManifest,
  type TemplateManifestIssue,
} from "@pivot/blocks";

import { SystemMessage } from "@/components/ui/system-message";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { bff } from "@/lib/bff";

/**
 * Das Manifest des Frontend-Templates – ansehen, erzeugen, hochladen,
 * zurücksetzen (Nutzerentscheidung, 2026-09-05).
 *
 * **Zwei Quellen, klare Rangfolge.** Normalerweise gilt die Datei im
 * Frontend-Projekt (`apps/site/src/template/manifest.ts`). Wird hier
 * eines hinterlegt, sticht es diese Datei – gedacht, um ein Template
 * anzupassen, ohne es neu zu deployen.
 *
 * **Was ein hochgeladenes Manifest NICHT kann**, und das steht auch so in
 * der Oberfläche: dem Template Fähigkeiten geben. Es beschreibt Felder und
 * Bereiche; ob ein Wert wirkt, hängt daran, ob das Template die genannte
 * CSS-Variable benutzt, und ob ein Bereich erscheint, daran, ob es ihn
 * rendert. Die Datei bleibt die Wahrheit darüber, was möglich ist.
 *
 * Der **Entwurf** kommt von der Website selbst: sie liest die Tokens aus
 * ihrer `globals.css` und leitet Schlüssel, Typ und Vorgabewert ab.
 * Beschriftungen und Gruppen muss ein Mensch nachtragen – deshalb landet
 * der Entwurf im Textfeld und wird nicht sofort gespeichert.
 */
export function TemplateManifestCard({
  value,
  onChange,
}: {
  value: TemplateManifest | null;
  onChange: (next: TemplateManifest | null) => void;
}) {
  const [text, setText] = useState(() =>
    value ? JSON.stringify(value, null, 2) : "",
  );
  const [issues, setIssues] = useState<TemplateManifestIssue[] | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  function applyText(raw: string) {
    setText(raw);
    setIssues(null);
    setNote(null);
  }

  function handleUse() {
    setNote(null);
    if (!text.trim()) {
      setIssues([{ path: "", message: "Es steht nichts im Feld." }]);
      return;
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch (error) {
      setIssues([
        {
          path: "",
          message: `Kein gültiges JSON: ${error instanceof Error ? error.message : "unbekannter Fehler"}`,
        },
      ]);
      return;
    }
    const found = validateTemplateManifest(parsed);
    setIssues(found);
    if (found.length > 0) return;
    onChange(parsed as TemplateManifest);
    setNote("Übernommen. Wirksam wird es mit dem Speichern der Einstellungen.");
  }

  function handleReset() {
    onChange(null);
    setText("");
    setIssues(null);
    setNote(
      "Zurückgesetzt: es gilt wieder die Manifest-Datei des Templates. Wirksam mit dem Speichern.",
    );
  }

  async function handleDraft() {
    setIsLoading(true);
    setIssues(null);
    setNote(null);
    try {
      const res = await fetch(bff("/api/template/draft"));
      const body = (await res.json()) as {
        draft: TemplateManifest | null;
        reason?: string;
        skipped?: { name: string; reason: string }[];
      };
      if (!body.draft) {
        setNote(body.reason ?? "Es kam kein Entwurf zurück.");
        return;
      }
      setText(JSON.stringify(body.draft, null, 2));
      const skipped = body.skipped ?? [];
      setNote(
        `Entwurf aus der CSS der Webseite erzeugt: ${body.draft.settings.length} Felder.` +
          (skipped.length > 0
            ? ` Übersprungen: ${skipped.map((s) => s.name).join(", ")} (verweisen auf andere Variablen).`
            : "") +
          " Beschriftungen und Gruppen bitte nachtragen, dann „Übernehmen“.",
      );
    } catch {
      setNote("Die Webseite ist nicht erreichbar.");
    } finally {
      setIsLoading(false);
    }
  }

  function handleFile(file: File) {
    const reader = new FileReader();
    reader.onload = () => applyText(String(reader.result ?? ""));
    reader.readAsText(file);
  }

  return (
    <div className="flex flex-col gap-3 sm:col-span-2">
      <div className="flex flex-col gap-1">
        <Label>Template-Manifest</Label>
        <p className="text-sm text-muted-foreground">
          {value
            ? "Es gilt das hier hinterlegte Manifest – es sticht die Datei des Frontend-Projekts."
            : "Es gilt die Manifest-Datei des Frontend-Projekts. Ein hier hinterlegtes Manifest würde sie stechen."}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          className="border-button-border"
          onClick={handleDraft}
          disabled={isLoading}
        >
          <Sparkles className="size-4" />
          {isLoading ? "Liest Webseite …" : "Entwurf erzeugen"}
        </Button>
        <Button
          type="button"
          variant="outline"
          className="border-button-border"
          onClick={() => fileInput.current?.click()}
        >
          <Upload className="size-4" />
          Datei laden
        </Button>
        <input
          ref={fileInput}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (file) handleFile(file);
          }}
        />
        <Button type="button" onClick={handleUse}>
          <FileJson className="size-4" />
          Übernehmen
        </Button>
        {value && (
          <Button
            type="button"
            variant="outline"
            className="border-button-border"
            onClick={handleReset}
          >
            <RotateCcw className="size-4" />
            Auf Template-Datei zurücksetzen
          </Button>
        )}
      </div>

      <Textarea
        rows={10}
        value={text}
        onChange={(e) => applyText(e.target.value)}
        placeholder='{ "name": "…", "regions": [], "settings": [] }'
        className="font-mono text-xs"
      />

      {issues && issues.length > 0 && (
        <SystemMessage
          variant="error"
          title="Manifest nicht übernommen"
          description={issues
            .map((issue) =>
              issue.path ? `${issue.path}: ${issue.message}` : issue.message,
            )
            .join(" · ")}
        />
      )}
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
