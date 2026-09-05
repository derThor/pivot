"use client";

import { useState } from "react";
import { Sparkles, Upload } from "lucide-react";
import {
  validateTemplateManifest,
  type TemplateManifest,
  type TemplateManifestIssue,
} from "@pivot/blocks";

import { TemplateManifestEditor } from "@/components/template-manifest-editor";
import { SystemMessage } from "@/components/ui/system-message";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { bff } from "@/lib/bff";

/**
 * Der Manifest-Editor als Dialog – benutzt an zwei Stellen mit demselben
 * Inhalt: für das eingebaute Template (gespeichert in den Einstellungen)
 * und für jedes hochgeladene (gespeichert am Template selbst).
 *
 * Nutzervorgabe, 2026-09-05: *"bau das so um, das jedes manifest dynamisch
 * bearbeitet werden kann in der ui"*. Vorher gab es nur ein JSON-Textfeld,
 * und nur für das eingebaute Template.
 *
 * Der Dialog kennt nicht, WO gespeichert wird – das erledigt `onSave`.
 */
export function TemplateManifestDialog({
  trigger,
  title,
  manifest,
  onSave,
}: {
  trigger: React.ReactElement;
  title: string;
  manifest: TemplateManifest | null;
  /** Speichern; wirft oder gibt eine Meldung zurück, wenn es scheitert. */
  onSave: (next: TemplateManifest) => Promise<string | null>;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<TemplateManifest | null>(manifest);
  const [issues, setIssues] = useState<TemplateManifestIssue[] | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function reset(next: boolean) {
    setOpen(next);
    if (next) {
      setDraft(manifest);
      setIssues(null);
      setNote(null);
    }
  }

  async function loadDraft() {
    setBusy(true);
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
      // Der Entwurf ersetzt die Felder, behält aber den Namen: den hat
      // meist schon jemand gesetzt, und der Generator kennt nur den des
      // laufenden Templates.
      setDraft({
        ...body.draft,
        name: draft?.name?.trim() ? draft.name : body.draft.name,
      });
      const skipped = body.skipped ?? [];
      setNote(
        `Entwurf aus der CSS der Webseite: ${body.draft.settings.length} Felder.` +
          (skipped.length > 0
            ? ` Übersprungen: ${skipped.map((s) => s.name).join(", ")}.`
            : "") +
          " Beschriftungen und Gruppen bitte nachtragen.",
      );
    } catch {
      setNote("Die Webseite ist nicht erreichbar.");
    } finally {
      setBusy(false);
    }
  }

  function loadFile(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed: unknown = JSON.parse(String(reader.result ?? ""));
        const found = validateTemplateManifest(parsed);
        setIssues(found.length > 0 ? found : null);
        if (found.length === 0) {
          setDraft(parsed as TemplateManifest);
          setNote("Datei übernommen.");
        }
      } catch (error) {
        setIssues([
          {
            path: "",
            message: `Kein gültiges JSON: ${
              error instanceof Error ? error.message : "unbekannt"
            }`,
          },
        ]);
      }
    };
    reader.readAsText(file);
  }

  async function handleSave() {
    if (!draft) return;
    const found = validateTemplateManifest(draft);
    setIssues(found);
    if (found.length > 0) return;
    setBusy(true);
    setNote(null);
    try {
      const error = await onSave(draft);
      if (error) {
        setNote(error);
        return;
      }
      setOpen(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={reset}>
      <DialogTrigger render={trigger} />
      <DialogContent className="flex max-h-[85vh] flex-col overflow-hidden sm:max-w-3xl">
        <DialogHeader className="shrink-0">
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4 overflow-y-auto">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              className="border-button-border"
              disabled={busy}
              onClick={() => void loadDraft()}
            >
              <Sparkles className="size-4" />
              Entwurf aus der Webseite
            </Button>
            <label>
              <input
                type="file"
                accept="application/json,.json"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (file) loadFile(file);
                }}
              />
              <Button
                type="button"
                variant="outline"
                className="border-button-border pointer-events-none"
                tabIndex={-1}
              >
                <Upload className="size-4" />
                Datei laden
              </Button>
            </label>
          </div>

          {note && (
            <SystemMessage variant="info" title="Hinweis" description={note} />
          )}

          <TemplateManifestEditor
            manifest={draft}
            onChange={setDraft}
            issues={issues}
          />
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            className="border-button-border"
            onClick={() => setOpen(false)}
          >
            Abbrechen
          </Button>
          <Button
            type="button"
            onClick={() => void handleSave()}
            disabled={busy}
          >
            {busy ? "Speichert…" : "Speichern"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
