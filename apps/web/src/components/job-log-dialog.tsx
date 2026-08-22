"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatRelativePast, formatDuration } from "@/lib/jobs-format";
import type { JobRunsResponse } from "@/lib/api-server";

const STATUS_DOT: Record<string, string> = {
  success: "bg-green-500",
  error: "bg-red-500",
};

/** "Letztes Protokoll"-Button im "Jobs"-Reiter (Nutzervorgabe, 2026-08-22)
 * – zeigt die Lauf-Historie eines einzelnen Jobs, gleiche Zeilen-Optik wie
 * die app-weite "Letzte Läufe"-Karte, aber auf diesen einen Job gefiltert
 * und mit eigener, dialoginterner Seite-Vor/-Zurück-Pagination statt
 * URL-Query-Param (kein eigener Seiten-Pfad für ein Modal). */
export function JobLogDialog({
  jobId,
  jobTitle,
  open,
  onOpenChange,
}: {
  jobId: string | null;
  jobTitle: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [data, setData] = useState<JobRunsResponse | null>(null);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!open || !jobId) return;
    setIsLoading(true);
    fetch(`/api/jobs/${jobId}/runs?page=${page}&pageSize=10`)
      .then((res) => res.json())
      .then(setData)
      .finally(() => setIsLoading(false));
  }, [open, jobId, page]);

  useEffect(() => {
    if (open) setPage(1);
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Protokoll: {jobTitle}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-2">
          {isLoading && !data ? (
            <p className="text-sm text-muted-foreground">Lädt…</p>
          ) : !data || data.items.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Noch keine Läufe protokolliert.
            </p>
          ) : (
            data.items.map((run) => (
              <div
                key={run.id}
                className="flex items-center justify-between gap-4 rounded-lg border border-[#F0F0F0] bg-[#FAFAFA] p-3"
              >
                <div className="flex items-start gap-2.5">
                  <span
                    className={`mt-1.5 size-2 shrink-0 rounded-full ${STATUS_DOT[run.status] ?? "bg-muted-foreground"}`}
                  />
                  <div>
                    <p className="text-sm font-medium">
                      {formatRelativePast(run.startedAt)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {run.message ?? "—"}
                    </p>
                  </div>
                </div>
                <span className="shrink-0 font-mono text-xs text-muted-foreground">
                  {formatDuration(run.durationMs)}
                </span>
              </div>
            ))
          )}
        </div>
        {data && data.meta.pageCount > 1 && (
          <div className="flex items-center justify-between">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="border-[#D4D4D4]"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Zurück
            </Button>
            <span className="text-xs text-muted-foreground">
              Seite {data.meta.page} von {data.meta.pageCount}
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="border-[#D4D4D4]"
              disabled={page >= data.meta.pageCount}
              onClick={() => setPage((p) => p + 1)}
            >
              Weiter
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
