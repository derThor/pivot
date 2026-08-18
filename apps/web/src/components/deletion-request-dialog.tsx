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
import type { DeletionRequest, DeletionRequestStatus } from "@/lib/api-server";

const EMPTY_FORM = {
  requesterName: "",
  requesterEmail: "",
  reason: "",
  status: "open" as DeletionRequestStatus,
  dueAt: "",
};

function toForm(row: DeletionRequest) {
  return {
    requesterName: row.requesterName,
    requesterEmail: row.requesterEmail,
    reason: row.reason ?? "",
    status: row.status,
    dueAt: row.dueAt ? row.dueAt.slice(0, 10) : "",
  };
}

export const DELETION_REQUEST_STATUS_LABELS: Record<
  DeletionRequestStatus,
  string
> = {
  open: "Offen",
  in_progress: "In Bearbeitung",
  completed: "Erledigt",
  rejected: "Abgelehnt",
};

export function DeletionRequestDialog({
  target,
  onOpenChange,
  onSaved,
}: {
  target: DeletionRequest | null | "new";
  onOpenChange: (open: boolean) => void;
  onSaved: (row: DeletionRequest) => void;
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
    if (!form.requesterName.trim() || !form.requesterEmail.trim()) {
      setError("Bitte Name und E-Mail-Adresse angeben.");
      return;
    }
    setError(null);
    setIsSubmitting(true);
    try {
      const payload = {
        requesterName: form.requesterName,
        requesterEmail: form.requesterEmail,
        reason: form.reason || undefined,
        status: form.status,
        dueAt: form.dueAt ? new Date(form.dueAt).toISOString() : undefined,
      };
      const res = await fetch(
        isEdit ?
          `/api/deletion-requests/${(target as DeletionRequest).id}`
        : "/api/deletion-requests",
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
      if (isEdit) toastEdited(`Löschanfrage von „${form.requesterName}“ wurde aktualisiert.`);
      else toastCreated(`Löschanfrage von „${form.requesterName}“ wurde angelegt.`);
      onSaved(data as DeletionRequest);
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
            {isEdit ? "Löschanfrage bearbeiten" : "Löschanfrage anlegen"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1">
              <Label htmlFor="dr-name">Name</Label>
              <Input
                id="dr-name"
                autoFocus
                value={form.requesterName}
                onChange={(e) =>
                  setForm((p) => ({ ...p, requesterName: e.target.value }))
                }
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="dr-email">E-Mail</Label>
              <Input
                id="dr-email"
                type="email"
                value={form.requesterEmail}
                onChange={(e) =>
                  setForm((p) => ({ ...p, requesterEmail: e.target.value }))
                }
              />
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="dr-reason">Grund</Label>
            <Textarea
              id="dr-reason"
              rows={3}
              value={form.reason}
              onChange={(e) => setForm((p) => ({ ...p, reason: e.target.value }))}
            />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1">
              <Label htmlFor="dr-status">Status</Label>
              <select
                id="dr-status"
                className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                value={form.status}
                onChange={(e) =>
                  setForm((p) => ({
                    ...p,
                    status: e.target.value as DeletionRequestStatus,
                  }))
                }
              >
                {Object.entries(DELETION_REQUEST_STATUS_LABELS).map(
                  ([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ),
                )}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="dr-due">Frist</Label>
              <Input
                id="dr-due"
                type="date"
                value={form.dueAt}
                onChange={(e) => setForm((p) => ({ ...p, dueAt: e.target.value }))}
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
