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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { formatName } from "@/lib/utils";
import { bff } from "@/lib/bff";
import type {
  CurrentUser,
  DataSubjectRequestType,
  DeletionRequest,
  DeletionRequestStatus,
} from "@/lib/api-server";

export const DATA_SUBJECT_REQUEST_TYPE_LABELS: Record<
  DataSubjectRequestType,
  string
> = {
  deletion: "Löschung",
  access: "Auskunft",
  rectification: "Berichtigung",
};

const EMPTY_FORM = {
  type: "deletion" as DataSubjectRequestType,
  requesterName: "",
  requesterEmail: "",
  reason: "",
  source: "",
  affectedRecordsCount: "",
  status: "open" as DeletionRequestStatus,
  dueAt: "",
};

function toForm(row: DeletionRequest) {
  return {
    type: row.type,
    requesterName: row.requesterName,
    requesterEmail: row.requesterEmail,
    reason: row.reason ?? "",
    source: row.source ?? "",
    affectedRecordsCount:
      row.affectedRecordsCount != null ? String(row.affectedRecordsCount) : "",
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
  users,
  onOpenChange,
  onSaved,
}: {
  target: DeletionRequest | null | "new";
  users: CurrentUser[];
  onOpenChange: (open: boolean) => void;
  onSaved: (row: DeletionRequest) => void;
}) {
  const open = target !== null;
  const isEdit = target !== null && target !== "new";
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  // Anfragende Person kann entweder ein bestehendes Konto sein oder frei
  // eingetragen werden – externe Anfragen (Post, Telefon) haben kein Konto
  // (Nutzervorgabe, 2026-08-19: "muss ein Nutzer auch auswählbar sein").
  // Die Auswahl übernimmt Name/E-Mail nur als Vorbelegung, beide Felder
  // bleiben danach frei editierbar.
  const sortedUsers = [...users]
    .filter((u) => !u.anonymizedAt)
    .sort((a, b) => formatName(a).localeCompare(formatName(b), "de"));

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
        type: form.type,
        requesterName: form.requesterName,
        requesterEmail: form.requesterEmail,
        reason: form.reason || undefined,
        source: form.source || undefined,
        affectedRecordsCount:
          form.affectedRecordsCount !== ""
            ? Number(form.affectedRecordsCount)
            : undefined,
        status: form.status,
        dueAt: form.dueAt ? new Date(form.dueAt).toISOString() : undefined,
      };
      const res = await fetch(
        isEdit
          ? bff(`/api/deletion-requests/${(target as DeletionRequest).id}`)
          : bff("/api/deletion-requests"),
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
      if (isEdit)
        toastEdited(`Anfrage von „${form.requesterName}“ wurde aktualisiert.`);
      else toastCreated(`Anfrage von „${form.requesterName}“ wurde angelegt.`);
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
            {isEdit ? "Anfrage bearbeiten" : "Anfrage anlegen"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <Label htmlFor="dr-type" required>
              Art
            </Label>
            <select
              id="dr-type"
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              value={form.type}
              onChange={(e) =>
                setForm((p) => ({
                  ...p,
                  type: e.target.value as DataSubjectRequestType,
                }))
              }
            >
              {Object.entries(DATA_SUBJECT_REQUEST_TYPE_LABELS).map(
                ([value, label]) => (
                  <option
                    key={value}
                    value={value}
                    className="bg-background text-foreground"
                  >
                    {label}
                  </option>
                ),
              )}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="dr-user">Bestehende Person wählen (optional)</Label>
            <Select
              value=""
              onValueChange={(userId) => {
                const user = sortedUsers.find((u) => u.id === userId);
                if (!user) return;
                setForm((p) => ({
                  ...p,
                  requesterName: formatName(user),
                  requesterEmail: user.email,
                }));
              }}
              items={Object.fromEntries(
                sortedUsers.map((u) => [u.id, `${formatName(u)} (${u.email})`]),
              )}
            >
              <SelectTrigger id="dr-user" className="w-full">
                <SelectValue placeholder="Person wählen – oder unten frei eintragen" />
              </SelectTrigger>
              <SelectContent>
                {sortedUsers.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {formatName(u)} ({u.email})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1">
              <Label htmlFor="dr-name" required>
                Name
              </Label>
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
              <Label htmlFor="dr-email" required>
                E-Mail
              </Label>
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
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1">
              <Label htmlFor="dr-source">Quelle</Label>
              <Input
                id="dr-source"
                placeholder="z.B. Formular „Kontaktanfrage“"
                value={form.source}
                onChange={(e) =>
                  setForm((p) => ({ ...p, source: e.target.value }))
                }
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="dr-affected">Betroffene Datensätze</Label>
              <Input
                id="dr-affected"
                type="number"
                min={0}
                value={form.affectedRecordsCount}
                onChange={(e) =>
                  setForm((p) => ({
                    ...p,
                    affectedRecordsCount: e.target.value,
                  }))
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
              onChange={(e) =>
                setForm((p) => ({ ...p, reason: e.target.value }))
              }
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
                    <option
                      key={value}
                      value={value}
                      className="bg-background text-foreground"
                    >
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
                onChange={(e) =>
                  setForm((p) => ({ ...p, dueAt: e.target.value }))
                }
              />
              <p className="text-xs text-muted-foreground">
                Leer = 1 Monat ab Eingang (Art. 12(3) DSGVO).
              </p>
            </div>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              className="border-border"
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
