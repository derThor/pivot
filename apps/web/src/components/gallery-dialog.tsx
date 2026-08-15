"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { GallerySettingsEditor } from "@/components/global-module-form-dialog";
import { DEFAULT_GALLERY_SETTINGS, type GallerySettings } from "@/lib/gallery-settings";
import type { ModuleType } from "@/lib/api-server";

/** Schlanker Anlegen-Dialog nur für Name + Anzeige-Einstellungen einer
 * Bildergalerie (Nutzervorgabe, 2026-08-15) – ohne Bilder-Verwaltung.
 * Bilder werden erst danach über die "Bilder hinzufügen"-Kachel auf der
 * (dann noch leeren) Galerie-Karte ergänzt (siehe gallery-grid.tsx, öffnet
 * dafür den vollständigen `GlobalModuleFormDialog`).
 *
 * Validierungsfehler direkt unter dem betroffenen Feld statt als
 * Sammel-Meldung unten im Formular (Nutzervorgabe, 2026-08-15, gilt als
 * Konvention für alle Dialoge) – `nameError` getrennt von `submitError`
 * (Server-/Netzwerkfehler, die zu keinem einzelnen Feld gehören). */
export function GalleryDialog({
  moduleType,
  hideTrigger,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
}: {
  moduleType: ModuleType;
  hideTrigger?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const router = useRouter();
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = controlledOnOpenChange ?? setInternalOpen;
  const [name, setName] = useState("");
  const [settings, setSettings] = useState<GallerySettings>(DEFAULT_GALLERY_SETTINGS);
  const [nameError, setNameError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function reset() {
    setName("");
    setSettings(DEFAULT_GALLERY_SETTINGS);
    setNameError(null);
    setSubmitError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setNameError("Bitte einen Namen angeben.");
      return;
    }
    setNameError(null);
    setSubmitError(null);
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/global-modules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          moduleTypeId: moduleType.id,
          values: { items: [] },
          settings,
        }),
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => null);
        setSubmitError(errBody?.message ?? "Konnte nicht gespeichert werden.");
        return;
      }
      setOpen(false);
      reset();
      router.refresh();
    } catch {
      setSubmitError("Server nicht erreichbar. Bitte später erneut versuchen.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      {!hideTrigger && (
        <DialogTrigger render={<Button />}>
          <Plus />
          Neue Bildergalerie
        </DialogTrigger>
      )}
      <DialogContent className="flex max-h-[85dvh] flex-col sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Neue Bildergalerie</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col gap-4">
          {/* `space-y-4` statt `flex flex-col gap-4`: verschachtelte
              Flex-Spalten innerhalb eines höhenbegrenzten Vorfahren können
              sich gegenseitig zusammenquetschen statt den Container
              überlaufen zu lassen (`scrollHeight` blieb dadurch fälschlich
              gleich `clientHeight`, obwohl Inhalt fehlte) – mit
              `space-y-*` behalten die Kinder ihre eigentliche Höhe, und
              `overflow-y-auto` bekommt wieder etwas zum Scrollen. */}
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto py-1">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="gallery-dialog-name">Name</Label>
              <Input
                id="gallery-dialog-name"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (nameError) setNameError(null);
                }}
                aria-invalid={nameError ? true : undefined}
                placeholder="z.B. Referenzen 2026"
              />
              {nameError && <p className="text-sm text-destructive">{nameError}</p>}
            </div>
            <GallerySettingsEditor
              settings={settings}
              onChange={setSettings}
              previewImages={[]}
              showPreview={false}
            />
            {submitError && <p className="text-sm text-destructive">{submitError}</p>}
          </div>
          <div className="flex shrink-0 justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Abbrechen
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Speichert…" : "Anlegen"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
