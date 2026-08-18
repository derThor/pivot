"use client";

import { FileText } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ContentRowActions } from "@/components/content-row-actions";
import { formatRelativeTime } from "@/lib/utils";
import type { ContentListItem, ContentStatus } from "@/lib/api-server";

const statusLabel: Record<ContentStatus, string> = {
  PUBLISHED: "Veröffentlicht",
  DRAFT: "Entwurf",
  SCHEDULED: "Geplant",
  ARCHIVED: "Archiviert",
};

const statusClassName: Record<ContentStatus, string> = {
  PUBLISHED:
    "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400",
  DRAFT:
    "bg-slate-200 text-slate-700 dark:bg-slate-500/20 dark:text-slate-300",
  SCHEDULED:
    "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400",
  ARCHIVED: "bg-sky-100 text-sky-700 dark:bg-sky-500/20 dark:text-sky-400",
};

export function ContentTable({ entries }: { entries: ContentListItem[] }) {
  return (
    <div className="overflow-hidden rounded-xl border border-[#E5E5E5] bg-card shadow-sm">
      <Table>
        <TableHeader className="bg-background">
          <TableRow>
            <TableHead>Titel</TableHead>
            <TableHead>Pfad</TableHead>
            <TableHead>Abschnitte</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Zuletzt bearbeitet</TableHead>
            <TableHead className="text-center">Aktionen</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {entries.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={6}
                className="h-24 text-center text-muted-foreground"
              >
                Noch keine Inhalte vorhanden.
              </TableCell>
            </TableRow>
          ) : (
            entries.map((entry) => (
              <TableRow key={entry.id}>
                <TableCell className="font-medium">
                  <span className="flex items-center gap-2">
                    <FileText className="size-4 shrink-0 text-muted-foreground" />
                    {entry.title}
                  </span>
                </TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground">
                  /{entry.slug}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {entry.sectionsCount}{" "}
                  {entry.sectionsCount === 1 ? "Baustein" : "Bausteine"}
                </TableCell>
                <TableCell>
                  <Badge
                    variant="secondary"
                    className={statusClassName[entry.status]}
                  >
                    {statusLabel[entry.status]}
                  </Badge>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {formatRelativeTime(entry.updatedAt)}
                </TableCell>
                <TableCell>
                  <ContentRowActions id={entry.id} title={entry.title} />
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
