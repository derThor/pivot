"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Info, Plus, Trash2 } from "lucide-react";

import { toastDeleted, toastEdited } from "@/components/app-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  DATA_SUBJECT_REQUEST_TYPE_LABELS,
  DeletionRequestDialog,
} from "@/components/deletion-request-dialog";
import { ConfirmDeleteDialog } from "@/components/confirm-delete-dialog";
import { Switch } from "@/components/ui/switch";
import { cn, truncateMiddle } from "@/lib/utils";
import { bff } from "@/lib/bff";
import type {
  CurrentUser,
  DataSubjectRequestType,
  DeletionRequest,
  PrivacySettings,
} from "@/lib/api-server";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function initialsFromName(name: string) {
  return (
    name
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]!.toUpperCase())
      .join("") || "?"
  );
}

function formatDeadline(
  dueAt: string | null,
  status: string,
): { text: string; urgent: boolean } {
  if (status === "completed" || status === "rejected" || !dueAt) {
    return { text: "–", urgent: false };
  }
  const diffMs = new Date(dueAt).getTime() - Date.now();
  const days = Math.ceil(diffMs / (24 * 60 * 60 * 1000));
  if (days < 0) return { text: "überfällig", urgent: true };
  if (days === 0) return { text: "heute", urgent: true };
  if (days === 1) return { text: "morgen", urgent: true };
  return { text: `in ${days} Tagen`, urgent: false };
}

const TYPE_BADGE_CLASSNAME: Record<DataSubjectRequestType, string> = {
  deletion: "badge--ink border-0",
  access: "badge--slate border-0",
  rectification: "badge--slate border-0",
};

// Eigene, kompaktere Zeile statt der globalen `SwitchRow` (die nutzt
// `Label`s Standard-`text-base` – wirkt in dieser schmalen 360px-
// Seitenspalte zu groß und bricht auf zwei Zeilen um, siehe
// Nutzer-Bugreport per Screenshot, 2026-08-19). Größe an die übrige
// Kartendichte hier (`DetailRow` ist `text-sm`) angeglichen, statt die
// global genutzte `SwitchRow` zu verkleinern und damit Einstellungen/
// DSB-Tab ungefragt mitzuändern.
function CompactSwitchRow({
  label,
  description,
  checked,
  onCheckedChange,
  disabled,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border border-border bg-muted p-4">
      <div className="flex flex-col gap-0.5">
        <span
          className={cn(
            "text-sm font-medium",
            disabled && "text-muted-foreground",
          )}
        >
          {label}
        </span>
        {description && (
          <p className="text-xs text-muted-foreground">{description}</p>
        )}
      </div>
      <Switch
        checked={checked}
        onCheckedChange={onCheckedChange}
        disabled={disabled}
      />
    </div>
  );
}

function DetailRow({
  label,
  value,
  urgent,
  mono,
}: {
  label: string;
  value: string;
  urgent?: boolean;
  mono?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-2 first:pt-0 last:pb-0">
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <span
        className={cn(
          "min-w-0 truncate text-right",
          urgent && "font-medium text-red-600",
          mono && "font-mono text-xs",
        )}
      >
        {value}
      </span>
    </div>
  );
}

/** Betroffenenanfragen-Log (Nutzervorgabe, 2026-08-19, 1:1 nach
 * Bildvorlage): Liste+Detail statt der bisherigen einfachen Kartenliste.
 * "Datenauszug erstellen"/"Daten endgültig löschen"/"Rückfrage an
 * Absender" sind reine Protokoll-/Attestierungs-Aktionen, keine
 * Live-Datenlöschung – es gibt keine feste Verknüpfung zu konkreten
 * Datensätzen (kein Formular-Modul, Quelle ist freier Text). Details:
 * knowledge-base/auth/privacy-page.md. */
export function DataSubjectRequestsPanel({
  requests,
  onRequestsChange,
  users,
  settings,
}: {
  requests: DeletionRequest[];
  onRequestsChange: React.Dispatch<React.SetStateAction<DeletionRequest[]>>;
  users: CurrentUser[];
  settings: Pick<
    PrivacySettings,
    "dsrAutoAcknowledgeReceipt" | "dsrDeadlineReminderEnabled"
  >;
}) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState<string | null>(
    requests[0]?.id ?? null,
  );
  const [infoPopupTarget, setInfoPopupTarget] =
    useState<DeletionRequest | null>(null);
  const [dialogTarget, setDialogTarget] = useState<
    DeletionRequest | null | "new"
  >(null);
  const [completeTarget, setCompleteTarget] = useState<DeletionRequest | null>(
    null,
  );
  const [followUpTarget, setFollowUpTarget] = useState<DeletionRequest | null>(
    null,
  );
  const [followUpMessage, setFollowUpMessage] = useState("");
  const [isSendingFollowUp, setIsSendingFollowUp] = useState(false);
  const [followUpError, setFollowUpError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DeletionRequest | null>(
    null,
  );
  const [automatik, setAutomatik] = useState(settings);
  const [pendingAutomatikKey, setPendingAutomatikKey] = useState<
    keyof typeof settings | null
  >(null);

  const selected = requests.find((r) => r.id === selectedId) ?? null;

  function upsert(row: DeletionRequest) {
    onRequestsChange((prev) => {
      const exists = prev.some((r) => r.id === row.id);
      return exists
        ? prev.map((r) => (r.id === row.id ? row : r))
        : [row, ...prev];
    });
    setSelectedId(row.id);
    // Glocken-Badge im Header (`dashboard/layout.tsx`) wird serverseitig
    // berechnet und lebt im Layout, das bei reiner Client-Navigation nicht
    // neu rendert – ohne diesen Aufruf hinkt die Zahl nach Anlegen/
    // Erledigen hinterher (Nutzer-Bugreport, 2026-08-20: "aktualisiert
    // sich nicht zuverlässig").
    router.refresh();
  }

  async function handleSendFollowUp() {
    if (!followUpTarget || !followUpMessage.trim()) return;
    setIsSendingFollowUp(true);
    setFollowUpError(null);
    try {
      const res = await fetch(
        bff(`/api/deletion-requests/${followUpTarget.id}/follow-up`),
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: followUpMessage }),
        },
      );
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setFollowUpError(
          data?.message ?? "Rückfrage konnte nicht gesendet werden.",
        );
        return;
      }
      toastEdited(
        `Rückfrage wurde an ${followUpTarget.requesterEmail} gesendet.`,
      );
      setFollowUpTarget(null);
      setFollowUpMessage("");
    } catch {
      setFollowUpError(
        "Server nicht erreichbar. Bitte später erneut versuchen.",
      );
    } finally {
      setIsSendingFollowUp(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    await fetch(bff(`/api/deletion-requests/${deleteTarget.id}`), {
      method: "DELETE",
    });
    onRequestsChange((prev) => prev.filter((r) => r.id !== deleteTarget.id));
    if (selectedId === deleteTarget.id) setSelectedId(null);
    toastDeleted(`Anfrage ${deleteTarget.dsrId} wurde gelöscht.`);
    setDeleteTarget(null);
    router.refresh();
  }

  async function handleComplete() {
    if (!completeTarget) return;
    const res = await fetch(
      bff(`/api/deletion-requests/${completeTarget.id}/complete`),
      { method: "POST" },
    );
    const data = await res.json().catch(() => null);
    if (res.ok && data) {
      upsert(data as DeletionRequest);
      toastEdited(
        `„${completeTarget.requesterName}“ wurde als erledigt markiert.`,
      );
    }
    setCompleteTarget(null);
  }

  async function handleAutomatikToggle(
    key: keyof typeof settings,
    next: boolean,
  ) {
    setAutomatik((prev) => ({ ...prev, [key]: next }));
    setPendingAutomatikKey(key);
    try {
      await fetch(bff("/api/settings/privacy"), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [key]: next }),
      });
      router.refresh();
    } finally {
      setPendingAutomatikKey(null);
    }
  }

  return (
    <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-3">
      <div className="overflow-hidden rounded-xl bg-card shadow-sm lg:col-span-2">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
          <div className="flex items-center gap-3">
            <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              Anfragen · {requests.length}
            </p>
            <span className="text-xs text-muted-foreground">
              Frist: 1 Monat ab Eingang
            </span>
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="border-border"
            onClick={() => setDialogTarget("new")}
          >
            <Plus className="size-4" />
            Anfrage anlegen
          </Button>
        </div>
        {requests.length === 0 ? (
          <p className="px-6 py-6 text-sm text-muted-foreground">
            Noch keine Anfragen erfasst.
          </p>
        ) : (
          <div className="flex flex-col divide-y divide-border">
            {requests.map((row) => {
              const isSelected = row.id === selectedId;
              const deadline = formatDeadline(row.dueAt, row.status);
              return (
                <div
                  key={row.id}
                  className={cn(
                    "flex flex-col gap-2 border-l-4 px-4 py-4 transition-colors sm:flex-row sm:items-center sm:justify-between",
                    isSelected
                      ? "border-l-primary bg-primary/15"
                      : "border-l-transparent hover:bg-muted/50",
                  )}
                >
                  <button
                    type="button"
                    onClick={() => setSelectedId(row.id)}
                    className="flex min-w-0 flex-1 items-center gap-3 text-left"
                  >
                    <span
                      className={cn(
                        "flex size-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold",
                        isSelected
                          ? "bg-primary/25 text-foreground"
                          : "bg-secondary text-muted-foreground",
                      )}
                    >
                      {initialsFromName(row.requesterName)}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate font-semibold">
                        {row.requesterName}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {row.dsrId} · {row.requesterEmail}
                      </p>
                    </div>
                  </button>
                  <div className="flex shrink-0 items-center gap-3 pl-12 sm:pl-0">
                    <Badge className={TYPE_BADGE_CLASSNAME[row.type]}>
                      {DATA_SUBJECT_REQUEST_TYPE_LABELS[row.type]}
                    </Badge>
                    <span
                      className={cn(
                        "w-16 text-xs",
                        deadline.urgent
                          ? "font-medium text-red-600"
                          : "text-muted-foreground",
                      )}
                    >
                      {deadline.text}
                    </span>
                    <Badge
                      className={
                        row.status === "completed" || row.status === "rejected"
                          ? "bg-green-100 text-green-700 hover:bg-green-100"
                          : "bg-amber-100 text-amber-800 hover:bg-amber-100"
                      }
                    >
                      {row.status === "completed" || row.status === "rejected"
                        ? "Erledigt"
                        : "Offen"}
                    </Badge>
                    <button
                      type="button"
                      aria-label="Alle Informationen zur Anfrage anzeigen"
                      onClick={() => setInfoPopupTarget(row)}
                      className="flex size-7 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    >
                      <Info className="size-4" />
                    </button>
                    <button
                      type="button"
                      aria-label={`„${row.requesterName}“ löschen`}
                      onClick={() => setDeleteTarget(row)}
                      className="flex size-7 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-4">
        {selected ? (
          <Card className="rounded-xl shadow-sm">
            <CardHeader>
              <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                Anfrage
              </p>
              <CardTitle>{selected.requesterName}</CardTitle>
              <p className="font-mono text-sm text-muted-foreground">
                {selected.dsrId}
              </p>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="flex flex-col divide-y divide-border text-sm">
                <DetailRow
                  label="Art"
                  value={DATA_SUBJECT_REQUEST_TYPE_LABELS[selected.type]}
                />
                <DetailRow
                  label="Eingang"
                  value={formatDate(selected.createdAt)}
                />
                <DetailRow
                  label="Frist"
                  value={formatDeadline(selected.dueAt, selected.status).text}
                  urgent={
                    formatDeadline(selected.dueAt, selected.status).urgent
                  }
                />
                {selected.source && (
                  <DetailRow label="Quelle" value={selected.source} />
                )}
                {selected.affectedRecordsCount != null && (
                  <DetailRow
                    label="Betroffene Datensätze"
                    value={String(selected.affectedRecordsCount)}
                  />
                )}
              </div>
              <Button
                type="button"
                className="w-full"
                render={
                  <a
                    href={bff(
                      `/api/deletion-requests/${selected.id}/data-extract`,
                    )}
                  />
                }
              >
                Datenauszug erstellen
              </Button>
              <Button
                type="button"
                variant="outline"
                className="w-full border-border text-destructive hover:bg-destructive/5"
                disabled={
                  selected.status === "completed" ||
                  selected.status === "rejected"
                }
                onClick={() => setCompleteTarget(selected)}
              >
                {selected.status === "completed" ||
                selected.status === "rejected"
                  ? "Bereits erledigt"
                  : "Daten endgültig löschen"}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="w-full border-border"
                onClick={() => setFollowUpTarget(selected)}
              >
                Rückfrage an Absender
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="rounded-xl bg-card p-6 text-sm text-muted-foreground shadow-sm">
            Wähle links eine Anfrage aus oder lege eine neue an.
          </div>
        )}

        <Card className="rounded-xl shadow-sm">
          <CardHeader>
            <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              Automatik
            </p>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <CompactSwitchRow
              label="Eingang automatisch bestätigen"
              description="Mail an den Absender innerhalb von 24 Std."
              checked={automatik.dsrAutoAcknowledgeReceipt}
              disabled={pendingAutomatikKey === "dsrAutoAcknowledgeReceipt"}
              onCheckedChange={(checked) =>
                handleAutomatikToggle("dsrAutoAcknowledgeReceipt", checked)
              }
            />
            <CompactSwitchRow
              label="Erinnerung 7 Tage vor Fristende"
              checked={automatik.dsrDeadlineReminderEnabled}
              disabled={pendingAutomatikKey === "dsrDeadlineReminderEnabled"}
              onCheckedChange={(checked) =>
                handleAutomatikToggle("dsrDeadlineReminderEnabled", checked)
              }
            />
          </CardContent>
        </Card>
      </div>

      <DeletionRequestDialog
        target={dialogTarget}
        users={users}
        onOpenChange={(open) => !open && setDialogTarget(null)}
        onSaved={upsert}
      />

      <ConfirmDeleteDialog
        open={completeTarget !== null}
        onOpenChange={(open) => !open && setCompleteTarget(null)}
        title="Wurde die Löschung außerhalb des Systems erledigt?"
        description="Markiert die Anfrage als erledigt. Es gibt keine automatische Löschung von Systemdaten, da keine feste Verknüpfung zu konkreten Datensätzen besteht."
        confirmLabel="Als erledigt markieren"
        confirmingLabel="Speichert…"
        variant="default"
        onConfirm={handleComplete}
      />

      <ConfirmDeleteDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title={`„${truncateMiddle(deleteTarget?.requesterName ?? "")}“ löschen?`}
        description="Entfernt die Anfrage vollständig aus dem Log. Wird sie später erneut gebraucht (z.B. für einen Compliance-Nachweis), ist sie nicht wiederherstellbar."
        onConfirm={handleDelete}
      />

      <Dialog
        open={followUpTarget !== null}
        onOpenChange={(open) => {
          if (!open) {
            setFollowUpTarget(null);
            setFollowUpMessage("");
            setFollowUpError(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              Rückfrage an {followUpTarget?.requesterName}
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="dr-followup-message" required>
              Nachricht
            </Label>
            <Textarea
              id="dr-followup-message"
              rows={5}
              autoFocus
              placeholder="Was möchtest du den Absender fragen?"
              value={followUpMessage}
              onChange={(e) => setFollowUpMessage(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Wird an {followUpTarget?.requesterEmail} gesendet.
            </p>
            {followUpError && (
              <p className="text-sm text-destructive">{followUpError}</p>
            )}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              className="border-border"
              onClick={() => {
                setFollowUpTarget(null);
                setFollowUpMessage("");
                setFollowUpError(null);
              }}
            >
              Abbrechen
            </Button>
            <Button
              type="button"
              disabled={!followUpMessage.trim() || isSendingFollowUp}
              onClick={handleSendFollowUp}
            >
              {isSendingFollowUp ? "Sendet…" : "Absenden"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={infoPopupTarget !== null}
        onOpenChange={(open) => !open && setInfoPopupTarget(null)}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{infoPopupTarget?.requesterName}</DialogTitle>
          </DialogHeader>
          {infoPopupTarget && (
            <div className="flex flex-col divide-y divide-border text-sm">
              <DetailRow label="DSR-ID" value={infoPopupTarget.dsrId} />
              <DetailRow
                label="Art"
                value={DATA_SUBJECT_REQUEST_TYPE_LABELS[infoPopupTarget.type]}
              />
              <DetailRow
                label="Status"
                value={
                  infoPopupTarget.status === "completed" ||
                  infoPopupTarget.status === "rejected"
                    ? "Erledigt"
                    : "Offen"
                }
              />
              <DetailRow label="Name" value={infoPopupTarget.requesterName} />
              <DetailRow
                label="E-Mail"
                value={infoPopupTarget.requesterEmail}
              />
              <DetailRow
                label="Eingang"
                value={formatDate(infoPopupTarget.createdAt)}
              />
              {infoPopupTarget.dueAt && (
                <DetailRow
                  label="Frist"
                  value={formatDate(infoPopupTarget.dueAt)}
                />
              )}
              {infoPopupTarget.source && (
                <DetailRow label="Quelle" value={infoPopupTarget.source} />
              )}
              {infoPopupTarget.affectedRecordsCount != null && (
                <DetailRow
                  label="Betroffene Datensätze"
                  value={String(infoPopupTarget.affectedRecordsCount)}
                />
              )}
              {infoPopupTarget.reason && (
                <DetailRow label="Grund" value={infoPopupTarget.reason} />
              )}
              {infoPopupTarget.completedAt && (
                <DetailRow
                  label="Erledigt am"
                  value={formatDate(infoPopupTarget.completedAt)}
                />
              )}
            </div>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              className="border-border"
              onClick={() => setInfoPopupTarget(null)}
            >
              Schließen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
