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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatRelativePast } from "@/lib/jobs-format";
import type { JobRunStatusFilter, JobRunsResponse } from "@/lib/api-server";
import { bff } from "@/lib/bff";

const STATUS_DOT: Record<string, string> = {
  success: "bg-green-500",
  error: "bg-red-500",
};

/** Reiter der Karte (Nutzervorgabe, 2026-09-03). "alle" ist kein Status
 * in der Datenbank, sondern das Weglassen des Filters – deshalb ein
 * eigener Schlüssel statt `undefined` im Reiter-Zustand. */
const TAB_ALL = "alle";

const EMPTY_TEXT: Record<string, string> = {
  alle: "Noch keine Läufe protokolliert.",
  success: "Keine erfolgreichen Läufe.",
  error: "Keine fehlgeschlagenen Läufe — gut so.",
};

/** "Jobs"-Reiter unter Einstellungen, Karte "Letzte Läufe" (Nutzervorgabe,
 * 2026-08-22, 1:1 nach Bildvorlage) – app-weit über alle Jobs hinweg,
 * neueste zuerst, mit echter Server-Pagination (Nutzervorgabe: "bei den
 * letzte läufe pagination beachten", in der Bildvorlage selbst nicht
 * gezeigt). "Alle Jobs pausieren" ist nach oben in JobRunRetentionCard
 * gewandert (Nutzervorgabe, 2026-08-30). */
export function RecentJobRunsCard({
  runs: initialRuns,
  status,
}: {
  runs: JobRunsResponse;
  /** Aktiver Reiter; `undefined` = "Alle". */
  status?: JobRunStatusFilter;
}) {
  const router = useRouter();
  const activeTab = status ?? TAB_ALL;
  // Der Reiter steht in der URL, nicht im lokalen Zustand: gefiltert wird
  // serverseitig (sonst zeigte "Seite 2" einen Ausschnitt aus einer
  // anderen Grundmenge), und die Seite lädt ihre Daten aus genau diesen
  // Query-Parametern. Gleiches Muster wie die Pagination darunter.
  const hrefFor = (tab: string, page: number) =>
    tab === TAB_ALL
      ? `?jobsRunsPage=${page}`
      : `?jobsRunsStatus=${tab}&jobsRunsPage=${page}`;
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
          `/api/jobs/runs?page=${runs.meta.page}&pageSize=${runs.meta.pageSize}${
            status ? `&status=${status}` : ""
          }`,
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
                  className="border-button-border"
                  disabled={runs.items.length === 0}
                >
                  Alle löschen
                </Button>
              }
              title={
                status
                  ? "Alle Läufe endgültig löschen?"
                  : `${runs.meta.total} Läufe endgültig löschen?`
              }
              description={
                status
                  ? "Gelöscht wird die gesamte Historie, nicht nur der angezeigte Reiter. Diese Aktion kann nicht rückgängig gemacht werden."
                  : "Diese Aktion kann nicht rückgängig gemacht werden."
              }
              onConfirm={handleDeleteAll}
            />
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
          </div>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <Tabs
          value={activeTab}
          onValueChange={(value) => router.push(hrefFor(String(value), 1))}
        >
          <TabsList className="!h-auto w-fit justify-start gap-1 !overflow-visible p-1">
            <TabsTrigger value={TAB_ALL}>Alle</TabsTrigger>
            <TabsTrigger value="success">Erfolgreich</TabsTrigger>
            <TabsTrigger value="error">Fehler</TabsTrigger>
          </TabsList>
        </Tabs>
        {runs.items.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {EMPTY_TEXT[activeTab]}
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
            buildHref={(p) => hrefFor(activeTab, p)}
          />
        )}
      </CardContent>
    </Card>
  );
}
