"use client";

import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PaginationControls } from "@/components/pagination-controls";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { SwitchRow } from "@/components/switch-row";
import { JobLogDialog } from "@/components/job-log-dialog";
import {
  CUSTOM_RHYTHM,
  RHYTHM_PRESETS,
  formatDuration,
  formatRelativeFuture,
  formatRelativePast,
} from "@/lib/jobs-format";
import type { ScheduledJob, ScheduledJobsResponse } from "@/lib/api-server";
import { bff } from "@/lib/bff";

const RHYTHM_ITEMS = {
  ...Object.fromEntries(RHYTHM_PRESETS.map((p) => [p.cron, p.label])),
  [CUSTOM_RHYTHM]: "Benutzerdefiniert",
};

/** "Jobs"-Reiter unter Einstellungen, Karte "Geplante Aufgaben"
 * (Nutzervorgabe, 2026-08-22, 1:1 nach Bildvorlage). Nur die drei real
 * vorhandenen Jobs (siehe JobsService.definitions im Backend) – bewusst
 * keine Bildvorlage-Jobs ohne echte Grundlage in dieser App
 * (Papierkorb-Auto-Löschung, Sitemap/Suchindex, Link-Check, Backup). Ein
 * Klick auf eine Zeile klappt ein Bearbeiten-Panel auf (nur eine Zeile
 * gleichzeitig), alle Felder speichern sofort (kein separater
 * "Speichern"-Button, gleiches Instant-Save-Prinzip wie die übrigen
 * Einstellungen-Schalter). */
export function ScheduledJobsCard({
  jobs: initialJobs,
}: {
  jobs: ScheduledJobsResponse;
}) {
  const [jobs, setJobs] = useState(initialJobs);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [cronDraft, setCronDraft] = useState("");
  const [logDialogJob, setLogDialogJob] = useState<ScheduledJob | null>(null);
  const [runningId, setRunningId] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Bei Seitenwechsel über die Pagination liefert die Seite neue Props
  // (URL-Query `?jobsPage=`) – lokalen Stand synchron halten.
  useEffect(() => {
    setJobs(initialJobs);
  }, [initialJobs]);

  function updateJobLocal(updated: ScheduledJob) {
    setJobs((prev) => ({
      ...prev,
      items: prev.items.map((j) => (j.id === updated.id ? updated : j)),
    }));
  }

  // Aktualisiert nur diese Karte per Client-Fetch (Nutzervorgabe,
  // 2026-08-22: "um den bereich zu refreschen, ohne die seite neu zu
  // laden") – kein `router.refresh()`, das würde die ganze Seite
  // serverseitig neu rendern.
  async function handleRefresh() {
    setIsRefreshing(true);
    try {
      const res = await fetch(
        bff(`/api/jobs?page=${jobs.meta.page}&pageSize=${jobs.meta.pageSize}`),
      );
      const data = await res.json().catch(() => null);
      if (res.ok && data) setJobs(data);
    } finally {
      setIsRefreshing(false);
    }
  }

  async function patchJob(id: string, body: Record<string, unknown>) {
    const res = await fetch(bff(`/api/jobs/${id}`), {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => null);
    if (res.ok && data) updateJobLocal(data);
  }

  function handleExpand(job: ScheduledJob) {
    if (expandedId === job.id) {
      setExpandedId(null);
    } else {
      setExpandedId(job.id);
      setCronDraft(job.cronExpression);
    }
  }

  async function handleCronBlur(job: ScheduledJob) {
    const next = cronDraft.trim();
    if (!next || next === job.cronExpression) return;
    await patchJob(job.id, { cronExpression: next });
  }

  async function handleRunNow(job: ScheduledJob) {
    setRunningId(job.id);
    try {
      const res = await fetch(bff(`/api/jobs/${job.id}/run`), {
        method: "POST",
      });
      const data = await res.json().catch(() => null);
      if (res.ok && data) updateJobLocal(data);
    } finally {
      setRunningId(null);
    }
  }

  return (
    <>
      <Card className="rounded-xl shadow-sm">
        <CardHeader>
          <CardTitle>Geplante Aufgaben</CardTitle>
          <p className="text-sm text-muted-foreground">
            Läufe starten serverseitig. Ein pausierter Job wird übersprungen,
            nicht nachgeholt.
          </p>
          <CardAction>
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              className="rounded-lg border-button-border"
              aria-label="Aktualisieren"
              disabled={isRefreshing}
              onClick={handleRefresh}
            >
              <RefreshCw
                className={isRefreshing ? "size-4 animate-spin" : "size-4"}
              />
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent className="@container flex flex-col gap-3">
          {jobs.items.map((job) => {
            const expanded = expandedId === job.id;
            return (
              <div
                key={job.id}
                className={
                  expanded
                    ? "rounded-xl border-2 border-primary bg-primary/10 p-3"
                    : "rounded-lg border border-border bg-muted p-3"
                }
              >
                <div className="flex items-center gap-4">
                  {/* Eingeklappt bewusst nur Titel, Status und Schalter
                      (Nutzervorgabe, 2026-08-31) – Beschreibung, Rhythmus
                      und Zeitpunkte stehen im aufgeklappten Bereich. Das
                      "kritisch"-Badge bleibt: es erklärt, warum der
                      Schalter bei diesen Jobs nicht bedienbar ist. */}
                  <button
                    type="button"
                    onClick={() => handleExpand(job)}
                    className="flex min-w-0 flex-1 items-center gap-2 text-left"
                  >
                    <span className="truncate text-sm font-medium">
                      {job.title}
                    </span>
                    {job.isCritical && (
                      <Badge variant="secondary">kritisch</Badge>
                    )}
                  </button>
                  <Badge
                    className={
                      job.effectivelyPaused
                        ? "badge--slate border-0"
                        : "badge--green border-0"
                    }
                  >
                    {job.effectivelyPaused ? "pausiert" : "aktiv"}
                  </Badge>
                  <Switch
                    checked={!job.isPaused}
                    disabled={job.isCritical}
                    onCheckedChange={(checked) =>
                      patchJob(job.id, { isPaused: !checked })
                    }
                  />
                </div>

                {expanded && (
                  <div className="mt-3 flex flex-col gap-3">
                    <p className="text-xs text-muted-foreground">
                      {job.description}
                    </p>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div className="flex flex-col gap-1">
                        <Label className="text-xs text-muted-foreground uppercase">
                          Rhythmus
                        </Label>
                        <Select
                          value={
                            RHYTHM_PRESETS.some((p) => p.cron === cronDraft)
                              ? cronDraft
                              : CUSTOM_RHYTHM
                          }
                          onValueChange={(value) => {
                            if (!value || value === CUSTOM_RHYTHM) return;
                            setCronDraft(value);
                            patchJob(job.id, { cronExpression: value });
                          }}
                          items={RHYTHM_ITEMS}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {RHYTHM_PRESETS.map((p) => (
                              <SelectItem key={p.cron} value={p.cron}>
                                {p.label}
                              </SelectItem>
                            ))}
                            <SelectItem value={CUSTOM_RHYTHM}>
                              Benutzerdefiniert
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex flex-col gap-1">
                        <Label className="text-xs text-muted-foreground uppercase">
                          Cron-Ausdruck
                        </Label>
                        <Input
                          className="font-mono"
                          value={cronDraft}
                          onChange={(e) => setCronDraft(e.target.value)}
                          onBlur={() => handleCronBlur(job)}
                        />
                        <p className="text-xs text-muted-foreground">
                          Minute Stunde Tag Monat Wochentag
                        </p>
                      </div>
                    </div>

                    <SwitchRow
                      label="Bei Fehler benachrichtigen"
                      description="E-Mail an Administratoren"
                      checked={job.notifyOnFailure}
                      onCheckedChange={(checked) =>
                        patchJob(job.id, { notifyOnFailure: checked })
                      }
                      className="border-border bg-white"
                    />
                    <SwitchRow
                      label="Als kritisch markieren"
                      description="Kritische Jobs lassen sich nicht dauerhaft pausieren"
                      checked={job.isCritical}
                      onCheckedChange={(checked) =>
                        patchJob(job.id, { isCritical: checked })
                      }
                      className="border-border bg-white"
                    />

                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          disabled={runningId === job.id}
                          onClick={() => handleRunNow(job)}
                        >
                          {runningId === job.id ? "Läuft…" : "Jetzt ausführen"}
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          className="border-button-border"
                          onClick={() => setLogDialogJob(job)}
                        >
                          Letztes Protokoll
                        </Button>
                      </div>
                      {/* Letzter Lauf steht bewusst nur hier, nicht mehr in
                          der eingeklappten Zeile (Nutzervorgabe,
                          2026-08-31: "in der Übersicht im eingeklappten
                          Zustand keinen Zeitpunkt anzeigen"). */}
                      <p className="text-xs text-muted-foreground">
                        {job.totalRuns.toLocaleString("de-DE")} Läufe ·{" "}
                        {job.totalErrors.toLocaleString("de-DE")} Fehler ·
                        letzter: {formatRelativePast(job.lastRunAt)}
                        {job.lastRunAt &&
                          ` (${formatDuration(job.lastRunDurationMs)})`}{" "}
                        · nächster: {formatRelativeFuture(job.nextRunAt)}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          {jobs.meta.pageCount > 1 && (
            <PaginationControls
              page={jobs.meta.page}
              pageCount={jobs.meta.pageCount}
              buildHref={(p) => `?jobsPage=${p}`}
            />
          )}
        </CardContent>
      </Card>
      <JobLogDialog
        jobId={logDialogJob?.id ?? null}
        jobTitle={logDialogJob?.title ?? ""}
        open={logDialogJob !== null}
        onOpenChange={(open) => !open && setLogDialogJob(null)}
      />
    </>
  );
}
