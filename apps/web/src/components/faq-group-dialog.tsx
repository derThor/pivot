"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";

import { toastCreated, toastEdited } from "@/components/app-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { GlobalModule, ModuleType } from "@/lib/api-server";

/** Schlanker Anlegen-/Bearbeiten-Dialog nur für Name + Beschreibung einer
 * FAQ-Gruppe (Nutzervorgabe, 2026-08-15: Gruppe anlegen und Fragen
 * hinzufügen sind zwei getrennte, jeweils minimale Popups statt eines
 * gemeinsamen großen Formulars mit allen Fragen). Fragen werden
 * ausschließlich über `FaqQuestionDialog` (+ inline "Löschen") verwaltet. */
export function FaqGroupDialog({
  moduleType,
  group,
  hideTrigger,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
}: {
  moduleType: ModuleType;
  group?: GlobalModule;
  hideTrigger?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const router = useRouter();
  const isEditing = Boolean(group);
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = controlledOnOpenChange ?? setInternalOpen;
  const [name, setName] = useState(group?.name ?? "");
  const [description, setDescription] = useState(
    typeof group?.values.description === "string"
      ? group.values.description
      : "",
  );
  // Validierungsfehler direkt unters betroffene Feld statt als
  // Sammel-Meldung (Nutzervorgabe, 2026-08-15, gilt als Konvention für
  // alle Dialoge) – `nameError` getrennt von `submitError`.
  const [nameError, setNameError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function reset() {
    setName(group?.name ?? "");
    setDescription(
      typeof group?.values.description === "string"
        ? group.values.description
        : "",
    );
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
      const url = isEditing
        ? `/api/global-modules/${group!.id}`
        : "/api/global-modules";
      const method = isEditing ? "PATCH" : "POST";
      const body = isEditing
        ? { name, values: { ...group!.values, description } }
        : {
            name,
            moduleTypeId: moduleType.id,
            values: { description, items: [] },
          };

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => null);
        setSubmitError(errBody?.message ?? "Konnte nicht gespeichert werden.");
        return;
      }
      setOpen(false);
      if (!isEditing) reset();
      if (isEditing) toastEdited();
      else toastCreated(`„${name}“ wurde angelegt.`);
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
          Neue FAQ-Gruppe
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "FAQ-Gruppe bearbeiten" : "Neue FAQ-Gruppe"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="faq-group-name" required>
              Name
            </Label>
            <Input
              id="faq-group-name"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (nameError) setNameError(null);
              }}
              aria-invalid={nameError ? true : undefined}
              placeholder="z.B. Allgemeines"
            />
            {nameError && (
              <p className="text-sm text-destructive">{nameError}</p>
            )}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="faq-group-description">Beschreibung</Label>
            <Textarea
              id="faq-group-description"
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Kurze Beschreibung dieser FAQ-Gruppe."
            />
          </div>
          {submitError && (
            <p className="text-sm text-destructive">{submitError}</p>
          )}
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              className="border-border"
              onClick={() => setOpen(false)}
            >
              Abbrechen
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting
                ? "Speichert…"
                : isEditing
                  ? "Änderungen speichern"
                  : "Anlegen"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
