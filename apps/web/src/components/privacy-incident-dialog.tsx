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
import { Textarea } from "@/components/ui/textarea";
import type {
  PrivacyIncident,
  PrivacyIncidentSeverity,
  PrivacyIncidentStatus,
} from "@/lib/api-server";

const EMPTY_FORM = {
  title: "",
  description: "",
  severity: "low" as PrivacyIncidentSeverity,
  status: "open" as PrivacyIncidentStatus,
  occurredAt: "",
};

function toForm(row: PrivacyIncident) {
  return {
    title: row.title,
    description: row.description ?? "",
    severity: row.severity,
    status: row.status,
    occurredAt: row.occurredAt ? row.occurredAt.slice(0, 10) : "",
  };
}

export const PRIVACY_INCIDENT_SEVERITY_LABELS: Record<
  PrivacyIncidentSeverity,
  string
> = {
  low: "Niedrig",
  medium: "Mittel",
  high: "Hoch",
};

export function PrivacyIncidentDialog({
  target,
  onOpenChange,
  onSaved,
}: {
  target: PrivacyIncident | null | "new";
  onOpenChange: (open: boolean) => void;
  onSaved: (row: PrivacyIncident) => void;
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
    if (!form.title.trim()) {
      setError("Bitte einen Titel angeben.");
      return;
    }
    setError(null);
    setIsSubmitting(true);
    try {
      const payload = {
        title: form.title,
        description: form.description || undefined,
        severity: form.severity,
        status: form.status,
        occurredAt:
          form.occurredAt ? new Date(form.occurredAt).toISOString() : undefined,
      };
      const res = await fetch(
        isEdit ?
          `/api/privacy-incidents/${(target as PrivacyIncident).id}`
        : "/api/privacy-incidents",
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
      if (isEdit) toastEdited(`„${form.title}“ wurde aktualisiert.`);
      else toastCreated(`„${form.title}“ wurde angelegt.`);
      onSaved(data as PrivacyIncident);
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
          <DialogTitle>{isEdit ? "Vorfall bearbeiten" : "Vorfall erfassen"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <Label htmlFor="pi-title">Titel</Label>
            <Input
              id="pi-title"
              autoFocus
              value={form.title}
              onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="pi-description">Beschreibung</Label>
            <Textarea
              id="pi-description"
              rows={3}
              value={form.description}
              onChange={(e) =>
                setForm((p) => ({ ...p, description: e.target.value }))
              }
            />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="flex flex-col gap-1">
              <Label htmlFor="pi-severity">Schweregrad</Label>
              <select
                id="pi-severity"
                className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                value={form.severity}
                onChange={(e) =>
                  setForm((p) => ({
                    ...p,
                    severity: e.target.value as PrivacyIncidentSeverity,
                  }))
                }
              >
                {Object.entries(PRIVACY_INCIDENT_SEVERITY_LABELS).map(
                  ([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ),
                )}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="pi-status">Status</Label>
              <select
                id="pi-status"
                className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                value={form.status}
                onChange={(e) =>
                  setForm((p) => ({
                    ...p,
                    status: e.target.value as PrivacyIncidentStatus,
                  }))
                }
              >
                <option value="open">Offen</option>
                <option value="resolved">Behoben</option>
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="pi-occurred">Datum</Label>
              <Input
                id="pi-occurred"
                type="date"
                value={form.occurredAt}
                onChange={(e) =>
                  setForm((p) => ({ ...p, occurredAt: e.target.value }))
                }
              />
            </div>
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
