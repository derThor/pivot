"use client";

import { useEffect, useState } from "react";
import { Trash2, Upload } from "lucide-react";

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
import { bff } from "@/lib/bff";

const EMPTY_FORM = {
  name: "",
  purpose: "",
  hasContract: false,
  contractDate: "",
  contractMediaId: "",
  contractFilename: "",
  location: "",
  complianceNote: "",
  outsideEu: false,
  contactEmail: "",
};

function toForm(row: DataProcessor) {
  return {
    name: row.name,
    purpose: row.purpose ?? "",
    hasContract: row.hasContract,
    contractDate: row.contractDate ? row.contractDate.slice(0, 10) : "",
    contractMediaId: row.contractMediaId ?? "",
    contractFilename: row.contractMedia?.filename ?? "",
    location: row.location ?? "",
    complianceNote: row.complianceNote ?? "",
    outsideEu: row.outsideEu,
    contactEmail: row.contactEmail ?? "",
  };
}

export function DataProcessorDialog({
  target,
  avsFolderId,
  onOpenChange,
  onSaved,
}: {
  target: DataProcessor | null | "new";
  /** Ordner "AVs" (siehe seed.ts) – Ziel für den Vertrags-Upload. `null`,
   * falls der Systemordner ausnahmsweise fehlt (dann wird das Feld
   * deaktiviert statt in einen unbekannten Ordner hochzuladen). */
  avsFolderId: string | null;
  onOpenChange: (open: boolean) => void;
  onSaved: (row: DataProcessor) => void;
}) {
  const open = target !== null;
  const isEdit = target !== null && target !== "new";
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploadingContract, setIsUploadingContract] = useState(false);
  const [isRemovingContract, setIsRemovingContract] = useState(false);

  useEffect(() => {
    if (target && target !== "new") setForm(toForm(target));
    else if (target === "new") setForm(EMPTY_FORM);
    setError(null);
  }, [target]);

  async function handleContractUpload(file: File) {
    if (!avsFolderId) return;
    setIsUploadingContract(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.set("file", file);
      formData.set("folderId", avsFolderId);
      const res = await fetch(bff("/api/media"), {
        method: "POST",
        body: formData,
      });
      const uploaded = await res.json().catch(() => null);
      if (!res.ok) {
        setError(uploaded?.message ?? "Upload fehlgeschlagen.");
        return;
      }
      setForm((p) => ({
        ...p,
        contractMediaId: uploaded.id,
        contractFilename: uploaded.filename,
        hasContract: true,
      }));
    } catch {
      setError("Server nicht erreichbar. Bitte später erneut versuchen.");
    } finally {
      setIsUploadingContract(false);
    }
  }

  async function handleRemoveContract() {
    const mediaId = form.contractMediaId;
    setIsRemovingContract(true);
    setError(null);
    try {
      if (mediaId) {
        await fetch(bff(`/api/media/${mediaId}`), { method: "DELETE" });
      }
      setForm((p) => ({ ...p, contractMediaId: "", contractFilename: "" }));
    } catch {
      setError("Server nicht erreichbar. Bitte später erneut versuchen.");
    } finally {
      setIsRemovingContract(false);
    }
  }

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
        contractDate: form.contractDate
          ? new Date(form.contractDate).toISOString()
          : undefined,
        contractMediaId: form.contractMediaId,
        location: form.location || undefined,
        complianceNote: form.complianceNote || undefined,
        outsideEu: form.outsideEu,
        contactEmail: form.contactEmail || undefined,
      };
      const res = await fetch(
        isEdit
          ? bff(`/api/data-processors/${(target as DataProcessor).id}`)
          : bff("/api/data-processors"),
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
            {isEdit
              ? "Auftragsverarbeiter bearbeiten"
              : "Auftragsverarbeiter anlegen"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <Label htmlFor="dp-name" required>
              Name
            </Label>
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
              onChange={(e) =>
                setForm((p) => ({ ...p, purpose: e.target.value }))
              }
            />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1">
              <Label htmlFor="dp-location">Ort</Label>
              <Input
                id="dp-location"
                placeholder="z.B. Hamburg, DE"
                value={form.location}
                onChange={(e) =>
                  setForm((p) => ({ ...p, location: e.target.value }))
                }
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="dp-contact-email">Kontakt-E-Mail</Label>
              <Input
                id="dp-contact-email"
                type="email"
                placeholder="Für „AV-Vertrag anfordern“"
                value={form.contactEmail}
                onChange={(e) =>
                  setForm((p) => ({ ...p, contactEmail: e.target.value }))
                }
              />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
            <div className="flex flex-col gap-1">
              <Label htmlFor="dp-compliance-note">Zusatzhinweis</Label>
              <Input
                id="dp-compliance-note"
                placeholder="z.B. ISO 27001, SCC ausstehend"
                value={form.complianceNote}
                onChange={(e) =>
                  setForm((p) => ({ ...p, complianceNote: e.target.value }))
                }
              />
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <Label>Vertrags-PDF</Label>
            {avsFolderId ? (
              <div className="flex flex-wrap items-center gap-2">
                {form.contractFilename && (
                  <span className="flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium">
                    {form.contractFilename}
                    <button
                      type="button"
                      aria-label="Vertrags-PDF entfernen"
                      disabled={isRemovingContract}
                      onClick={handleRemoveContract}
                      className="text-muted-foreground hover:text-destructive disabled:pointer-events-none disabled:opacity-50"
                    >
                      <Trash2 className="size-3" />
                    </button>
                  </span>
                )}
                <Input
                  type="file"
                  accept="application/pdf"
                  disabled={isUploadingContract}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleContractUpload(file);
                  }}
                  className="w-full"
                />
                {isUploadingContract && (
                  <Upload className="size-4 shrink-0 animate-pulse text-muted-foreground" />
                )}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                Systemordner "AVs" nicht gefunden – Upload nicht möglich.
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              Wird im geschützten Ordner "AVs" gespeichert; "AV-Vertrag
              herunterladen" auf der Datenschutz-Seite zippt alle dort
              abgelegten Dateien.
            </p>
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
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={form.outsideEu}
              onCheckedChange={(checked) =>
                setForm((p) => ({ ...p, outsideEu: checked === true }))
              }
            />
            Verarbeitet Daten außerhalb der EU (Drittlandtransfer)
          </label>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              className="border-button-border"
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
