"use client";

import { useRouter } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ContentRowActions } from "@/components/content-row-actions";
import { SelectionToolbar } from "@/components/selection-toolbar";
import { useSelection } from "@/hooks/use-selection";
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

const dateFormatter = new Intl.DateTimeFormat("de-DE", {
  dateStyle: "medium",
  timeStyle: "short",
});

export function ContentTable({ entries }: { entries: ContentListItem[] }) {
  const router = useRouter();
  const { selected, toggle, toggleAll, clear, allSelected, someSelected, count } =
    useSelection(entries.map((entry) => entry.id));

  async function handleBulkDelete() {
    await Promise.all(
      [...selected].map((id) =>
        fetch(`/api/content/${id}`, { method: "DELETE" }),
      ),
    );
    clear();
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-3">
      <SelectionToolbar
        count={count}
        entityLabelPlural="Inhalte"
        onDelete={handleBulkDelete}
        onClear={clear}
      />
      <div className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <Checkbox
                  checked={allSelected}
                  indeterminate={someSelected}
                  onCheckedChange={toggleAll}
                  aria-label="Alle auswählen"
                />
              </TableHead>
              <TableHead>Titel</TableHead>
              <TableHead>Typ</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Kategorien</TableHead>
              <TableHead>Zuletzt bearbeitet</TableHead>
              <TableHead className="text-center">Aktionen</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {entries.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="h-24 text-center text-muted-foreground"
                >
                  Noch keine Inhalte vorhanden.
                </TableCell>
              </TableRow>
            ) : (
              entries.map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell>
                    <Checkbox
                      checked={selected.has(entry.id)}
                      onCheckedChange={() => toggle(entry.id)}
                      aria-label={`${entry.title} auswählen`}
                    />
                  </TableCell>
                  <TableCell className="font-medium">{entry.title}</TableCell>
                  <TableCell>{entry.contentType.name}</TableCell>
                  <TableCell>
                    <Badge
                      variant="secondary"
                      className={statusClassName[entry.status]}
                    >
                      {statusLabel[entry.status]}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {entry.categories.length === 0 ? (
                      <span className="text-muted-foreground">–</span>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {entry.categories.map((category) => (
                          <Badge key={category.id} variant="secondary">
                            {category.name}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    {dateFormatter.format(new Date(entry.updatedAt))}
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
    </div>
  );
}
