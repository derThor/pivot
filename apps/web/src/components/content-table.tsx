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
  PUBLISHED: "badge--green border-0",
  DRAFT: "badge--slate border-0",
  SCHEDULED: "badge--amber border-0",
  ARCHIVED: "badge--blue border-0",
};

export function ContentTable({
  entries,
  // Bei aktivem Status-/Suchfilter wäre "Noch keine Inhalte vorhanden."
  // schlicht falsch – es gibt Seiten, nur keine passenden (2026-09-01).
  emptyMessage = "Noch keine Inhalte vorhanden.",
}: {
  entries: ContentListItem[];
  emptyMessage?: string;
}) {
  return (
    <div className="overflow-hidden rounded-xl bg-card shadow-sm">
      <Table>
        <TableHeader>
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
                {emptyMessage}
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
