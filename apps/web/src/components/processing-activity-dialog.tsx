"use client";

import { useEffect, useState } from "react";

import { toastCreated, toastEdited } from "@/components/app-toast";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ProcessingActivity } from "@/lib/api-server";

const EMPTY_FORM = {
  purpose: "",
  legalBasis: "",
  dataCategories: "",
  retentionPeriod: "",
  recipients: "",
};

function toForm(row: ProcessingActivity) {
  return {
    purpose: row.purpose,
    legalBasis: row.legalBasis ?? "",
    dataCategories: row.dataCategories ?? "",
    retentionPeriod: row.retentionPeriod ?? "",
    recipients: row.recipients ?? "",
  };
}

export function ProcessingActivityDialog({
  target,
  onOpenChange,
  onSaved,
}: {
  target: ProcessingActivity | null | "new";
  onOpenChange: (open: boolean) => void;
  onSaved: (row: ProcessingActivity) => void;
}) {
  const open = target !== null;
  const isEdit = target !== null && target !== "new";
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (target && target !== "new") setForm(toForm(target));
    else if (target === "new") setForm(EMPTY_FORM);
    setError(null);
  }, [target]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!form.purpose.trim()) {
      setError("Bitte einen Zweck angeben.");
      return;
    }
    setError(null);
    setIsSubmitting(true);
    try {
      const payload = {
        purpose: form.purpose,
        legalBasis: form.legalBasis || undefined,
        dataCategories: form.dataCategories || undefined,
        retentionPeriod: form.retentionPeriod || undefined,
        recipients: form.recipients || undefined,
      };
      const res = await fetch(
        isEdit ?
          `/api/processing-activities/${(target as ProcessingActivity).id}`
        : "/api/processing-activities",
        {
          method: isEdit ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.message ?? "Konnte nicht gespeichert werden.");
        return;
      }
      if (isEdit) toastEdited(`„${form.purpose}“ wurde aktualisiert.`);
      else toastCreated(`„${form.purpose}“ wurde angelegt.`);
      onSaved(data as ProcessingActivity);
      onOpenChange(false);
    } catch {
      setError("Server nicht erreichbar. Bitte später erneut versuchen.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Verarbeitungstätigkeit bearbeiten" : "Verarbeitungstätigkeit anlegen"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <Label htmlFor="pa-purpose" required>Zweck</Label>
            <Input
              id="pa-purpose"
              autoFocus
              value={form.purpose}
              onChange={(e) => setForm((p) => ({ ...p, purpose: e.target.value }))}
              placeholder="z.B. Newsletter-Versand"
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="pa-legal-basis">Rechtsgrundlage</Label>
            <Input
              id="pa-legal-basis"
              value={form.legalBasis}
              onChange={(e) =>
                setForm((p) => ({ ...p, legalBasis: e.target.value }))
              }
              placeholder="z.B. Art. 6 Abs. 1 lit. a DSGVO"
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="pa-categories">Datenkategorien</Label>
            <Input
              id="pa-categories"
              value={form.dataCategories}
              onChange={(e) =>
                setForm((p) => ({ ...p, dataCategories: e.target.value }))
              }
              placeholder="z.B. Name, E-Mail-Adresse"
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="pa-retention">Löschfrist</Label>
            <Input
              id="pa-retention"
              value={form.retentionPeriod}
              onChange={(e) =>
                setForm((p) => ({ ...p, retentionPeriod: e.target.value }))
              }
              placeholder="z.B. 90 Tage, bis Widerruf, 10 Jahre"
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="pa-recipients">Empfänger</Label>
            <Input
              id="pa-recipients"
              value={form.recipients}
              onChange={(e) =>
                setForm((p) => ({ ...p, recipients: e.target.value }))
              }
              placeholder="z.B. Versanddienstleister"
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              className="border-[#D4D4D4]"
              onClick={() => onOpenChange(false)}
            >
              Abbrechen
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Speichert…" : "Speichern"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
