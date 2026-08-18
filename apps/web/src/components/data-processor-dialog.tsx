"use client";

import { useEffect, useState } from "react";

import { toastCreated, toastEdited } from "@/components/app-toast";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { DataProcessor } from "@/lib/api-server";

const EMPTY_FORM = {
  name: "",
  purpose: "",
  hasContract: false,
  contractDate: "",
};

function toForm(row: DataProcessor) {
  return {
    name: row.name,
    purpose: row.purpose ?? "",
    hasContract: row.hasContract,
    contractDate: row.contractDate ? row.contractDate.slice(0, 10) : "",
  };
}

export function DataProcessorDialog({
  target,
  onOpenChange,
  onSaved,
}: {
  target: DataProcessor | null | "new";
  onOpenChange: (open: boolean) => void;
  onSaved: (row: DataProcessor) => void;
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
    if (!form.name.trim()) {
      setError("Bitte einen Namen angeben.");
      return;
    }
    setError(null);
    setIsSubmitting(true);
    try {
      const payload = {
        name: form.name,
        purpose: form.purpose || undefined,
        hasContract: form.hasContract,
        contractDate:
          form.contractDate ? new Date(form.contractDate).toISOString() : undefined,
      };
      const res = await fetch(
        isEdit ?
          `/api/data-processors/${(target as DataProcessor).id}`
        : "/api/data-processors",
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
      if (isEdit) toastEdited(`„${form.name}“ wurde aktualisiert.`);
      else toastCreated(`„${form.name}“ wurde angelegt.`);
      onSaved(data as DataProcessor);
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
            {isEdit ? "Auftragsverarbeiter bearbeiten" : "Auftragsverarbeiter anlegen"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <Label htmlFor="dp-name">Name</Label>
            <Input
              id="dp-name"
              autoFocus
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              placeholder="z.B. Versanddienstleister GmbH"
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="dp-purpose">Zweck</Label>
            <Input
              id="dp-purpose"
              value={form.purpose}
              onChange={(e) => setForm((p) => ({ ...p, purpose: e.target.value }))}
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="dp-contract-date">Vertragsdatum</Label>
            <Input
              id="dp-contract-date"
              type="date"
              value={form.contractDate}
              onChange={(e) =>
                setForm((p) => ({ ...p, contractDate: e.target.value }))
              }
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={form.hasContract}
              onCheckedChange={(checked) =>
                setForm((p) => ({ ...p, hasContract: checked === true }))
              }
            />
            AV-Vertrag liegt vor
          </label>
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
