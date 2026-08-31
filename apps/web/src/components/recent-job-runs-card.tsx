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
import { formatRelativePast } from "@/lib/jobs-format";
import type { JobRunsResponse } from "@/lib/api-server";
import { bff } from "@/lib/bff";

const STATUS_DOT: Record<string, string> = {
  success: "bg-green-500",
  error: "bg-red-500",
};

/** "Jobs"-Reiter unter Einstellungen, Karte "Letzte Läufe" (Nutzervorgabe,
 * 2026-08-22, 1:1 nach Bildvorlage) – app-weit über alle Jobs hinweg,
 * neueste zuerst, mit echter Server-Pagination (Nutzervorgabe: "bei den
 * letzte läufe pagination beachten", in der Bildvorlage selbst nicht
 * gezeigt). "Alle Jobs pausieren" ist nach oben in JobRunRetentionCard
 * gewandert (Nutzervorgabe, 2026-08-30). */
export function RecentJobRunsCard({
  runs: initialRuns,
}: {
  runs: JobRunsResponse;
}) {
  const router = useRouter();
  const [runs, setRuns] = useState(initialRuns);
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
        bff(
          `/api/jobs/runs?page=${runs.meta.page}&pageSize=${runs.meta.pageSize}`,
        ),
      );
      const data = await res.json().catch(() => null);
      if (res.ok && data) setRuns(data);
    } finally {
      setIsRefreshing(false);
    }
  }

  async function handleDeleteAll() {
    await fetch(bff("/api/jobs/runs"), { method: "DELETE" });
    toastDeleted("Alle Läufe wurden gelöscht.");
    router.refresh();
  }

  return (
    <Card className="rounded-xl shadow-sm">
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
                  className="border-border"
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
              className="rounded-lg border-border"
              aria-label="Aktualisieren"
              disabled={isRefreshing}
              onClick={handleRefresh}
            >
              <RefreshCw
                className={isRefreshing ? "size-4 animate-spin" : "size-4"}
              />
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
              className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 rounded-lg border border-border bg-muted p-4"
            >
              <div className="flex min-w-0 items-start gap-2.5">
                <span
                  className={`mt-1.5 size-2 shrink-0 rounded-full ${STATUS_DOT[run.status] ?? "bg-muted-foreground"}`}
                />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{run.jobTitle}</p>
                  <p className="truncate text-sm text-muted-foreground">
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
      </CardContent>
    </Card>
  );
}
