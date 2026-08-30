"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { diffLines } from "diff";
import { ArrowLeft, History, Trash2 } from "lucide-react";

import { toastDeleted, toastEdited } from "@/components/app-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDeleteDialog } from "@/components/confirm-delete-dialog";
import { ContentPreviewRender } from "@/components/content-preview-render";
import { PaginationControls } from "@/components/pagination-controls";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  computeFieldChanges,
  stringifyForDisplay,
  summarizeFieldChanges,
} from "@/lib/content-version-diff";
import { cn, formatName, formatRelativeTime } from "@/lib/utils";
import type {
  AuthorRef,
  ContentDetail,
  ContentStatus,
  ContentVersion,
  ContentVersionsResponse,
  GlobalModule,
  ModuleType,
} from "@/lib/api-server";

// Gleiche Zuordnung wie content-table.tsx (dort nicht exportiert, daher
// hier dupliziert – kein gemeinsames lib-Modul für diese kleinen
// Label-/Farb-Maps in dieser Codebasis, siehe z.B. ACTION_LABELS in
// mehreren Backend-Dateien für dasselbe Prinzip).
const STATUS_LABEL: Record<ContentStatus, string> = {
  PUBLISHED: "Veröffentlicht",
  DRAFT: "Entwurf",
  SCHEDULED: "Geplant",
  ARCHIVED: "Archiviert",
};

const STATUS_BADGE_CLASS: Record<ContentStatus, string> = {
  PUBLISHED: "badge--green border-0",
  DRAFT: "badge--slate border-0",
  SCHEDULED: "badge--amber border-0",
  ARCHIVED: "badge--blue border-0",
};

interface Row {
  id: string;
  versionNumber: number;
  isCurrent: boolean;
  data: Record<string, unknown>;
  status: ContentStatus | null;
  statusBadge: { label: string; className: string } | null;
  createdAt: string | null;
  createdBy: AuthorRef | null;
  summary: string;
  /** Datenstand der nächstälteren Version zum Vergleich – `null`, wenn
   * keiner geladen ist (älteste bekannte Version, oder Seitenrand bei
   * Pagination, siehe unten). */
  compareData: Record<string, unknown> | null;
}

function unionFieldNames(a: Record<string, unknown>, b: Record<string, unknown>) {
  return Array.from(new Set([...Object.keys(a), ...Object.keys(b)]));
}

function buildRows(
  content: ContentDetail,
  versions: ContentVersion[],
  meta: ContentVersionsResponse["meta"],
): Row[] {
  const rows: Row[] = [];

  if (meta.page === 1) {
    const latest = versions[0] ?? null;
    const compareData = latest?.data ?? null;
    rows.push({
      id: "current",
      versionNumber: meta.total + 1,
      isCurrent: true,
      data: content.data,
      status: null,
      statusBadge: { label: "Aktuell", className: "badge--lime border-0" },
      createdAt: latest?.createdAt ?? content.updatedAt,
      createdBy: latest?.createdBy ?? content.author,
      summary: compareData
        ? summarizeFieldChanges(
            computeFieldChanges(
              compareData,
              content.data,
              unionFieldNames(compareData, content.data),
            ),
          )
        : "Ursprünglich gespeicherter Stand.",
      compareData,
    });
  }

  versions.forEach((version, i) => {
    const globalIndex = (meta.page - 1) * meta.pageSize + i;
    const versionNumber = meta.total - globalIndex;
    const olderVersion = versions[i + 1] ?? null;
    const compareData = olderVersion?.data ?? null;
    const isOldestOverall = globalIndex === meta.total - 1;

    const statusBadge =
      version.trigger === "ROLLBACK_BACKUP"
        ? { label: "Sicherung", className: "badge--slate border-0" }
        : version.status
          ? {
              label: STATUS_LABEL[version.status],
              className: STATUS_BADGE_CLASS[version.status],
            }
          : null;

    const summary =
      version.trigger === "ROLLBACK_BACKUP"
        ? "Vor Wiederherstellung automatisch gesichert."
        : compareData
          ? summarizeFieldChanges(
              computeFieldChanges(
                compareData,
                version.data,
                unionFieldNames(compareData, version.data),
              ),
            )
          : isOldestOverall
            ? "Ursprünglich gespeicherter Stand."
            : "Kein Vergleichsstand in dieser Ansicht geladen.";

    rows.push({
      id: version.id,
      versionNumber,
      isCurrent: false,
      data: version.data,
      status: version.status,
      statusBadge,
      createdAt: version.createdAt,
      createdBy: version.createdBy,
      summary,
      compareData,
    });
  });

  return rows;
}

interface DiffRow {
  num: number;
  type: "added" | "removed" | "context";
  text: string;
}

function buildLineDiff(oldText: string, newText: string): DiffRow[] {
  const parts = diffLines(oldText, newText);
  let lineNo = 1;
  const rows: DiffRow[] = [];
  for (const part of parts) {
    const lines = part.value.split("\n");
    if (lines[lines.length - 1] === "") lines.pop();
    for (const line of lines) {
      rows.push({
        num: lineNo++,
        type: part.added ? "added" : part.removed ? "removed" : "context",
        text: line,
      });
    }
  }
  return rows;
}

export function ContentVersionsExplorer({
  contentId,
  content,
  versions,
  meta,
  moduleTypes = [],
  globalModules = [],
}: {
  contentId: string;
  content: ContentDetail;
  versions: ContentVersion[];
  meta: ContentVersionsResponse["meta"];
  moduleTypes?: ModuleType[];
  globalModules?: GlobalModule[];
}) {
  const router = useRouter();
  const rows = useMemo(
    () => buildRows(content, versions, meta),
    [content, versions, meta],
  );
  const [selectedId, setSelectedId] = useState(rows[0]?.id ?? "current");
  const [tab, setTab] = useState<"preview" | "changes">("preview");
  const selectedRow = rows.find((r) => r.id === selectedId) ?? rows[0];

  const changeBlocks = useMemo(() => {
    if (!selectedRow?.compareData) return [];
    const fieldNames = unionFieldNames(selectedRow.compareData, selectedRow.data);
    const changes = computeFieldChanges(
      selectedRow.compareData,
      selectedRow.data,
      fieldNames,
    );
    return changes.map((change) => ({
      field: change.field,
      rows: buildLineDiff(
        stringifyForDisplay(change.oldValue),
        stringifyForDisplay(change.newValue),
      ),
    }));
  }, [selectedRow]);

  const totalAdded = changeBlocks.reduce(
    (sum, b) => sum + b.rows.filter((r) => r.type === "added").length,
    0,
  );
  const totalRemoved = changeBlocks.reduce(
    (sum, b) => sum + b.rows.filter((r) => r.type === "removed").length,
    0,
  );

  async function handleRollback(versionId: string) {
    await fetch(`/api/content/${contentId}/versions/${versionId}/rollback`, {
      method: "POST",
    });
    toastEdited("Die Version wurde wiederhergestellt.");
    router.refresh();
  }

  async function handleDelete(versionId: string) {
    await fetch(`/api/content/${contentId}/versions/${versionId}`, {
      method: "DELETE",
    });
    toastDeleted("Die Version wurde gelöscht.");
    router.refresh();
  }

  async function handleCopyDiff(block: { field: string; rows: DiffRow[] }) {
    const text = block.rows
      .map(
        (r) =>
          `${r.type === "added" ? "+" : r.type === "removed" ? "-" : " "} ${r.text}`,
      )
      .join("\n");
    await navigator.clipboard.writeText(text);
    toastEdited("Der Diff wurde in die Zwischenablage kopiert.");
  }

  if (!selectedRow) return null;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Button
            variant="ghost"
            size="sm"
            className="mb-2 -ml-2"
            render={<Link href={`/dashboard/content/${contentId}/edit`} />}
          >
            <ArrowLeft />
            Zurück zum Editor
          </Button>
          <h1 className="text-2xl font-semibold tracking-tight">Versionen</h1>
          <p className="text-sm text-muted-foreground">{content.title}</p>
        </div>
        <ConfirmDeleteDialog
          trigger={
            <Button type="button" variant="outline" disabled={selectedRow.isCurrent}>
              <History />
              Wiederherstellen
            </Button>
          }
          title={`Version ${selectedRow.versionNumber} wiederherstellen?`}
          description="Der aktuelle Stand wird vorher automatisch als neue Version gesichert – du kannst diese Aktion also selbst wieder rückgängig machen."
          confirmLabel="Wiederherstellen"
          confirmingLabel="Stellt wieder her…"
          variant="default"
          onConfirm={() => handleRollback(selectedRow.id)}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[320px_1fr] lg:items-start">
        <div className="flex flex-col gap-3">
          {rows.map((row) => {
            const active = row.id === selectedId;
            return (
              <div
                key={row.id}
                className={cn(
                  "flex w-full items-start gap-3 rounded-xl p-4 text-left transition-colors",
                  active
                    ? "border-2 border-primary bg-primary/10"
                    : "border border-border bg-card hover:bg-muted/50",
                )}
              >
                <button
                  type="button"
                  onClick={() => setSelectedId(row.id)}
                  className="flex min-w-0 flex-1 items-start gap-3 text-left"
                >
                  <span
                    className={cn(
                      "mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                      active
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground",
                    )}
                  >
                    {row.versionNumber}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-sm font-medium">
                        Version {row.versionNumber}
                      </p>
                      {row.statusBadge && (
                        <Badge variant="secondary" className={row.statusBadge.className}>
                          {row.statusBadge.label}
                        </Badge>
                      )}
                    </div>
                    <p className="truncate text-sm text-muted-foreground">
                      {row.summary}
                    </p>
                    <p className="mt-1 truncate text-xs text-muted-foreground">
                      {row.createdBy ? formatName(row.createdBy) : "—"}
                      {row.createdAt && ` · ${formatRelativeTime(row.createdAt)}`}
                    </p>
                  </div>
                </button>
                {!row.isCurrent && (
                  <ConfirmDeleteDialog
                    trigger={
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        className="shrink-0"
                        aria-label="Version löschen"
                      >
                        <Trash2 />
                      </Button>
                    }
                    title="Diese Version löschen?"
                    description="Diese Aktion kann nicht rückgängig gemacht werden. Der aktuelle Inhalt ist davon nicht betroffen, nur dieser historische Stand verschwindet aus der Versionshistorie."
                    onConfirm={() => handleDelete(row.id)}
                  />
                )}
              </div>
            );
          })}
          {meta.pageCount > 1 && (
            <PaginationControls
              page={meta.page}
              pageCount={meta.pageCount}
              buildHref={(p) => `?page=${p}`}
            />
          )}
        </div>

        <div className="min-w-0">
          <Tabs value={tab} onValueChange={(v) => setTab(v as "preview" | "changes")}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <TabsList>
                <TabsTrigger value="preview">Vorschau</TabsTrigger>
                <TabsTrigger value="changes">Änderungen</TabsTrigger>
              </TabsList>
              {tab === "changes" && changeBlocks.length > 0 && (
                <div className="flex items-center gap-3 text-xs font-medium">
                  <span className="text-emerald-600 dark:text-emerald-400">
                    +{totalAdded} hinzugefügt
                  </span>
                  <span className="text-destructive">-{totalRemoved} entfernt</span>
                </div>
              )}
            </div>

            <TabsContent value="preview">
              <div className="sticky top-4 flex max-h-[calc(100vh-2rem)] flex-col overflow-hidden rounded-xl border border-border bg-card">
                <div className="flex shrink-0 items-center gap-3 border-b border-border bg-muted px-4 py-2.5">
                  <div className="flex shrink-0 gap-1.5">
                    <span className="size-2.5 rounded-full bg-border" />
                    <span className="size-2.5 rounded-full bg-border" />
                    <span className="size-2.5 rounded-full bg-border" />
                  </div>
                  <div className="flex-1 truncate rounded-md bg-card px-3 py-1 text-center text-xs text-muted-foreground">
                    /{content.slug} · Vorschau · Version {selectedRow.versionNumber}
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto p-6">
                  <ContentPreviewRender
                    content={{
                      title: content.title,
                      status: selectedRow.status ?? content.status,
                      excerpt: content.excerpt,
                      data: selectedRow.data,
                      contentType: content.contentType,
                    }}
                    moduleTypes={moduleTypes}
                    globalModules={globalModules}
                  />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="changes" className="flex flex-col gap-4">
              {changeBlocks.length === 0 ? (
                <p className="rounded-xl border border-border bg-muted/30 p-6 text-sm text-muted-foreground">
                  {selectedRow.compareData
                    ? "Keine inhaltlichen Änderungen zur Vorversion."
                    : "Kein Vergleichsstand für diese Version verfügbar."}
                </p>
              ) : (
                changeBlocks.map((block) => (
                  <div
                    key={block.field}
                    className="overflow-hidden rounded-xl border border-border"
                  >
                    <div className="flex items-center justify-between gap-2 border-b border-border bg-muted px-4 py-2">
                      <p className="truncate text-sm font-medium">
                        {block.field} — Version {selectedRow.versionNumber} vs.
                        vorherige
                      </p>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => handleCopyDiff(block)}
                      >
                        diff
                      </Button>
                    </div>
                    <div className="overflow-x-auto bg-card p-3 font-mono text-xs leading-relaxed">
                      {block.rows.map((r, i) => (
                        <div
                          key={i}
                          className={cn(
                            "flex gap-3 px-2",
                            r.type === "added"
                              ? "bg-emerald-500/10"
                              : r.type === "removed"
                                ? "bg-destructive/10"
                                : undefined,
                          )}
                        >
                          <span className="w-6 shrink-0 select-none text-right text-muted-foreground">
                            {r.num}
                          </span>
                          <span
                            className={cn(
                              "shrink-0 select-none",
                              r.type === "added"
                                ? "text-emerald-600"
                                : r.type === "removed"
                                  ? "text-destructive"
                                  : "text-transparent",
                            )}
                          >
                            {r.type === "added"
                              ? "+"
                              : r.type === "removed"
                                ? "-"
                                : " "}
                          </span>
                          <span
                            className={cn(
                              "whitespace-pre-wrap break-all",
                              r.type === "added"
                                ? "text-emerald-700 dark:text-emerald-400"
                                : r.type === "removed"
                                  ? "text-destructive line-through"
                                  : undefined,
                            )}
                          >
                            {r.text}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
