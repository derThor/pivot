"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";

import { toastDeleted } from "@/components/app-toast";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ConfirmDeleteDialog } from "@/components/confirm-delete-dialog";
import { PaginationControls } from "@/components/pagination-controls";
import { SwitchRow } from "@/components/switch-row";
import { formatRelativePast } from "@/lib/jobs-format";
import type { JobRunsResponse } from "@/lib/api-server";

const STATUS_DOT: Record<string, string> = {
  success: "bg-green-500",
  error: "bg-red-500",
};

/** "Jobs"-Reiter unter Einstellungen, Karte "Letzte Läufe" (Nutzervorgabe,
 * 2026-08-22, 1:1 nach Bildvorlage) – app-weit über alle Jobs hinweg,
 * neueste zuerst, mit echter Server-Pagination (Nutzervorgabe: "bei den
 * letzte läufe pagination beachten", in der Bildvorlage selbst nicht
 * gezeigt). "Alle Jobs pausieren" ist bewusst ein EIGENSTÄNDIGER Schalter
 * (Nutzerentscheidung), nicht der bestehende Wartungsmodus – Beschreibung
 * daher ohne das Wort "Wartungsmodus", um keine Verbindung zur echten
 * Wartungsmodus-Funktion vorzutäuschen. */
export function RecentJobRunsCard({
  runs: initialRuns,
  jobsGloballyPaused,
}: {
  runs: JobRunsResponse;
  jobsGloballyPaused: boolean;
}) {
  const router = useRouter();
  const [runs, setRuns] = useState(initialRuns);
  const [globallyPaused, setGloballyPaused] = useState(jobsGloballyPaused);
  const [isSavingPause, setIsSavingPause] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [confirmAllOpen, setConfirmAllOpen] = useState(false);

  // Bei Seitenwechsel über die Pagination liefert die Seite neue Props
  // (URL-Query `?jobsRunsPage=`) – lokalen Stand synchron halten, damit
  // ein manuelles Refresh (siehe unten) danach nicht die falsche Seite
  // überschreibt.
  useEffect(() => {
    setRuns(initialRuns);
  }, [initialRuns]);

  // Aktualisiert nur diese Karte per Client-Fetch (Nutzervorgabe,
  // 2026-08-22: "bei letzte läufe auch") – kein `router.refresh()`, das
  // würde die ganze Seite serverseitig neu rendern.
  async function handleRefresh() {
    setIsRefreshing(true);
    try {
      const res = await fetch(
        `/api/jobs/runs?page=${runs.meta.page}&pageSize=${runs.meta.pageSize}`,
      );
      const data = await res.json().catch(() => null);
      if (res.ok && data) setRuns(data);
    } finally {
      setIsRefreshing(false);
    }
  }

  async function handleDeleteAll() {
    await fetch("/api/jobs/runs", { method: "DELETE" });
    toastDeleted("Alle Läufe wurden gelöscht.");
    router.refresh();
  }

  async function handleToggleGlobalPause(checked: boolean) {
    setGloballyPaused(checked);
    setIsSavingPause(true);
    try {
      await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobsGloballyPaused: checked }),
      });
      router.refresh();
    } finally {
      setIsSavingPause(false);
    }
  }

  return (
    <Card className="rounded-xl border-[#E5E5E5] shadow-sm">
      <CardHeader>
        <CardTitle>Letzte Läufe</CardTitle>
        <CardAction>
          <div className="flex gap-2">
            <ConfirmDeleteDialog
              open={confirmAllOpen}
              onOpenChange={setConfirmAllOpen}
              trigger={
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="border-[#D4D4D4]"
                  disabled={runs.items.length === 0}
                >
                  Alle löschen
                </Button>
              }
              title={`${runs.meta.total} Läufe endgültig löschen?`}
              description="Diese Aktion kann nicht rückgängig gemacht werden."
              onConfirm={handleDeleteAll}
            />
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              className="rounded-lg border-[#D4D4D4]"
              aria-label="Aktualisieren"
              disabled={isRefreshing}
              onClick={handleRefresh}
            >
              <RefreshCw className={isRefreshing ? "size-4 animate-spin" : "size-4"} />
            </Button>
          </div>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {runs.items.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Noch keine Läufe protokolliert.
          </p>
        ) : (
          runs.items.map((run) => (
            <div
              key={run.id}
              className="flex items-center justify-between gap-4 rounded-lg border border-[#F0F0F0] bg-[#FAFAFA] p-4"
            >
              <div className="flex items-start gap-2.5">
                <span
                  className={`mt-1.5 size-2 shrink-0 rounded-full ${STATUS_DOT[run.status] ?? "bg-muted-foreground"}`}
                />
                <div>
                  <p className="text-sm font-medium">{run.jobTitle}</p>
                  <p className="text-sm text-muted-foreground">
                    {run.message ?? "—"}
                  </p>
                </div>
              </div>
              <span className="shrink-0 font-mono text-sm text-muted-foreground">
                {formatRelativePast(run.startedAt)}
              </span>
            </div>
          ))
        )}
        {runs.meta.pageCount > 1 && (
          <PaginationControls
            page={runs.meta.page}
            pageCount={runs.meta.pageCount}
            buildHref={(p) => `?jobsRunsPage=${p}`}
          />
        )}
        <SwitchRow
          label="Alle Jobs pausieren"
          description="Nichts läuft automatisch, bis wieder aktiviert – kritische Jobs ausgenommen."
          checked={globallyPaused}
          disabled={isSavingPause}
          onCheckedChange={handleToggleGlobalPause}
        />
      </CardContent>
    </Card>
  );
}
