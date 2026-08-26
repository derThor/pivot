"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  CheckCircle2,
  Circle,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";

import { toastDeleted, toastEdited } from "@/components/app-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmDeleteDialog } from "@/components/confirm-delete-dialog";
import {
  PrivacyIncidentDialog,
  PRIVACY_INCIDENT_SEVERITY_LABELS,
} from "@/components/privacy-incident-dialog";
import { cn, truncateMiddle } from "@/lib/utils";
import type {
  PrivacyIncident,
  PrivacyIncidentSeverity,
} from "@/lib/api-server";

function formatDate(iso: string | null) {
  if (!iso) return "–";
  return new Date(iso).toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function formatDateTime(iso: string | null) {
  if (!iso) return "–";
  const d = new Date(iso);
  return `${formatDate(iso)} · ${d.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}`;
}

const RISK_BADGE_CLASSNAME: Record<PrivacyIncidentSeverity, string> = {
  low: "badge--slate border-0",
  medium: "badge--amber border-0",
  high: "badge--ink border-0",
};

const RISK_ICON_BOX_CLASSNAME: Record<PrivacyIncidentSeverity, string> = {
  low: "badge--slate",
  medium: "badge--amber",
  high: "badge--ink",
};

/** Ablauf-Schritte 3–5 (Meldung/Information/Maßnahmen) sind bei
 * severity="low" gegenstandslos – Art. 33/34 DSGVO verlangen dann keine
 * Meldung, siehe schema.prisma-Kommentar bei PrivacyIncident. */
function statusBadge(row: PrivacyIncident) {
  if (row.severity === "low") {
    return { label: "kein Risiko", className: "badge--green border-0" };
  }
  if (row.authorityNotifiedAt) {
    return { label: "gemeldet", className: "badge--amber border-0" };
  }
  return { label: "Offen", className: "badge--amber border-0" };
}

function ablaufSteps(row: PrivacyIncident) {
  const noActionNeeded = row.severity === "low";
  return [
    { label: "Vorfall erfassen", done: true },
    { label: "Risiko bewerten", done: true },
    {
      label: "Innerhalb 72 Std. melden",
      done: noActionNeeded || !!row.authorityNotifiedAt,
    },
    {
      label: "Betroffene informieren",
      done: noActionNeeded || !!row.subjectsNotifiedAt,
    },
    {
      label: "Maßnahmen dokumentieren",
      done: noActionNeeded || !!row.measuresDocumented,
    },
  ];
}

/** Vorfälle-Tab (Nutzervorgabe, 2026-08-20, 1:1 nach Bildvorlage):
 * Liste+Detail statt der bisherigen einfachen Kartenliste, analog zum
 * Betroffenenanfragen-Panel. "Behörde melden"/"Betroffene informieren"
 * sind reine Attestierungs-Aktionen (kein echter Versand an eine Behörde
 * oder an konkrete Personen) – gleiches Prinzip wie bei den
 * Betroffenenanfragen, da `affectedCount` nur eine manuelle Zahl ist. */
export function PrivacyIncidentsPanel({
  incidents,
  onIncidentsChange,
}: {
  incidents: PrivacyIncident[];
  onIncidentsChange: React.Dispatch<React.SetStateAction<PrivacyIncident[]>>;
}) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState<string | null>(
    incidents[0]?.id ?? null,
  );
  const [dialogTarget, setDialogTarget] = useState<
    PrivacyIncident | null | "new"
  >(null);
  const [deleteTarget, setDeleteTarget] = useState<PrivacyIncident | null>(
    null,
  );
  const [reportTarget, setReportTarget] = useState<PrivacyIncident | null>(
    null,
  );
  const [notifyTarget, setNotifyTarget] = useState<PrivacyIncident | null>(
    null,
  );

  const selected = incidents.find((r) => r.id === selectedId) ?? null;

  function upsert(row: PrivacyIncident) {
    onIncidentsChange((prev) => {
      const exists = prev.some((r) => r.id === row.id);
      return exists
        ? prev.map((r) => (r.id === row.id ? row : r))
        : [row, ...prev];
    });
    setSelectedId(row.id);
    router.refresh();
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    await fetch(`/api/privacy-incidents/${deleteTarget.id}`, {
      method: "DELETE",
    });
    onIncidentsChange((prev) => prev.filter((r) => r.id !== deleteTarget.id));
    if (selectedId === deleteTarget.id) setSelectedId(null);
    toastDeleted(`„${deleteTarget.title}“ wurde entfernt.`);
    setDeleteTarget(null);
    router.refresh();
  }

  async function handleReport() {
    if (!reportTarget) return;
    const res = await fetch(
      `/api/privacy-incidents/${reportTarget.id}/report`,
      {
        method: "POST",
      },
    );
    const data = await res.json().catch(() => null);
    if (res.ok && data) {
      upsert(data as PrivacyIncident);
      toastEdited(`„${reportTarget.title}“ wurde als gemeldet markiert.`);
    }
    setReportTarget(null);
  }

  async function handleNotify() {
    if (!notifyTarget) return;
    const res = await fetch(
      `/api/privacy-incidents/${notifyTarget.id}/notify-subjects`,
      { method: "POST" },
    );
    const data = await res.json().catch(() => null);
    if (res.ok && data) {
      upsert(data as PrivacyIncident);
      toastEdited(`Betroffene zu „${notifyTarget.title}“ wurden informiert.`);
    }
    setNotifyTarget(null);
  }

  return (
    <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[1fr_360px]">
      <div className="overflow-hidden rounded-xl bg-card shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
          <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            Vorfälle · {incidents.length}
          </p>
          <span className="text-xs text-muted-foreground">
            Meldefrist 72 Std.
          </span>
        </div>
        {incidents.length === 0 ? (
          <p className="px-6 py-6 text-sm text-muted-foreground">
            Noch keine Vorfälle erfasst.
          </p>
        ) : (
          <div className="flex flex-col divide-y divide-border">
            {incidents.map((row) => {
              const isSelected = row.id === selectedId;
              const badge = statusBadge(row);
              return (
                <button
                  key={row.id}
                  type="button"
                  onClick={() => setSelectedId(row.id)}
                  className={cn(
                    "flex items-center gap-3 border-l-4 px-4 py-4 text-left transition-colors",
                    isSelected
                      ? "border-l-primary bg-amber-50 dark:bg-primary/10"
                      : "border-l-transparent hover:bg-muted/50",
                  )}
                >
                  <span
                    className={cn(
                      "flex size-9 shrink-0 items-center justify-center rounded-lg",
                      RISK_ICON_BOX_CLASSNAME[row.severity],
                    )}
                  >
                    <AlertTriangle className="size-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{row.title}</p>
                    {row.description && (
                      <p className="truncate text-xs text-muted-foreground">
                        {row.description}
                      </p>
                    )}
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                    <Badge className={RISK_BADGE_CLASSNAME[row.severity]}>
                      Risiko{" "}
                      {PRIVACY_INCIDENT_SEVERITY_LABELS[
                        row.severity
                      ].toLowerCase()}
                    </Badge>
                    <span className="w-20 text-xs text-muted-foreground">
                      {formatDate(row.occurredAt)}
                    </span>
                    <Badge className={badge.className}>{badge.label}</Badge>
                  </div>
                </button>
              );
            })}
          </div>
        )}
        <button
          type="button"
          onClick={() => setDialogTarget("new")}
          className="flex w-full items-center gap-2 border-t border-border px-4 py-3 text-sm text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
        >
          <Plus className="size-4" />
          Vorfall erfassen
        </button>
      </div>

      <div className="flex flex-col gap-4">
        {selected ? (
          <Card className="rounded-xl shadow-sm">
            <CardHeader className="flex-row items-start justify-between">
              <div>
                <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                  Vorfall
                </p>
                <CardTitle>{selected.title}</CardTitle>
                {selected.description && (
                  <p className="text-sm text-muted-foreground">
                    {selected.description}
                  </p>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  aria-label={`„${selected.title}“ bearbeiten`}
                  onClick={() => setDialogTarget(selected)}
                  className="flex size-7 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  <Pencil className="size-4" />
                </button>
                <button
                  type="button"
                  aria-label={`„${selected.title}“ löschen`}
                  onClick={() => setDeleteTarget(selected)}
                  className="flex size-7 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="flex flex-col divide-y divide-border text-sm">
                <div className="flex items-center justify-between gap-4 py-2 first:pt-0">
                  <span className="text-muted-foreground">
                    Bekannt geworden
                  </span>
                  <span>{formatDate(selected.occurredAt)}</span>
                </div>
                <div className="flex items-center justify-between gap-4 py-2">
                  <span className="text-muted-foreground">Risiko</span>
                  <span>
                    {PRIVACY_INCIDENT_SEVERITY_LABELS[
                      selected.severity
                    ].toLowerCase()}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-4 py-2">
                  <span className="text-muted-foreground">Betroffene</span>
                  <span>{selected.affectedCount ?? "–"}</span>
                </div>
                <div className="flex items-center justify-between gap-4 py-2 last:pb-0">
                  <span className="text-muted-foreground">
                    Behörde gemeldet
                  </span>
                  <span>{formatDateTime(selected.authorityNotifiedAt)}</span>
                </div>
              </div>

              {selected.severity === "low" ? (
                <div className="badge--green rounded-lg border-0 px-3 py-2 text-xs">
                  Keine Meldepflicht — Bewertung dokumentiert.
                </div>
              ) : (
                <>
                  {selected.authorityNotifiedAt ? (
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full border-border"
                      render={
                        <a
                          href={`/api/privacy-incidents/${selected.id}/report`}
                        />
                      }
                    >
                      Meldung ansehen
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full border-border"
                      onClick={() => setReportTarget(selected)}
                    >
                      Behörde melden
                    </Button>
                  )}
                  <Button
                    type="button"
                    className="w-full"
                    disabled={!!selected.subjectsNotifiedAt}
                    onClick={() => setNotifyTarget(selected)}
                  >
                    {selected.subjectsNotifiedAt
                      ? `Betroffene informiert am ${formatDate(selected.subjectsNotifiedAt)}`
                      : "Betroffene informieren"}
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="rounded-xl bg-card p-6 text-sm text-muted-foreground shadow-sm">
            Wähle links einen Vorfall aus oder erfasse einen neuen.
          </div>
        )}

        {selected && (
          <Card className="rounded-xl shadow-sm">
            <CardHeader>
              <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                Ablauf
              </p>
            </CardHeader>
            <CardContent>
              <ul className="flex flex-col gap-3 text-sm">
                {ablaufSteps(selected).map((step) => (
                  <li key={step.label} className="flex items-center gap-2">
                    {step.done ? (
                      <CheckCircle2 className="size-4 shrink-0 text-primary" />
                    ) : (
                      <Circle className="size-4 shrink-0 text-muted-foreground" />
                    )}
                    <span
                      className={
                        step.done ? undefined : "text-muted-foreground"
                      }
                    >
                      {step.label}
                    </span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}
      </div>

      <PrivacyIncidentDialog
        target={dialogTarget}
        onOpenChange={(open) => !open && setDialogTarget(null)}
        onSaved={upsert}
      />

      <ConfirmDeleteDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title={`„${truncateMiddle(deleteTarget?.title ?? "")}“ löschen?`}
        description="Diese Aktion kann nicht rückgängig gemacht werden."
        onConfirm={handleDelete}
      />

      <ConfirmDeleteDialog
        open={reportTarget !== null}
        onOpenChange={(open) => !open && setReportTarget(null)}
        title="Wurde die Meldung an die Aufsichtsbehörde übermittelt?"
        description="Markiert den Vorfall als gemeldet und macht den Bericht über „Meldung ansehen“ abrufbar."
        confirmLabel="Als gemeldet markieren"
        confirmingLabel="Speichert…"
        variant="default"
        onConfirm={handleReport}
      />

      <ConfirmDeleteDialog
        open={notifyTarget !== null}
        onOpenChange={(open) => !open && setNotifyTarget(null)}
        title="Wurden die Betroffenen informiert?"
        description="Reine Protokoll-Funktion — es gibt keine feste Liste betroffener Personen, daher kein automatischer Versand."
        confirmLabel="Als informiert markieren"
        confirmingLabel="Speichert…"
        variant="default"
        onConfirm={handleNotify}
      />
    </div>
  );
}
