"use client";

import { useState } from "react";
import { SortableHead } from "@/components/sortable-head";
import { useRouter } from "next/navigation";

import { toastDeleted } from "@/components/app-toast";
import { ConfirmDeleteDialog } from "@/components/confirm-delete-dialog";
import { HighlightText } from "@/components/highlight-text";
import { RowActionButtons } from "@/components/row-action-buttons";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TaxonomyItemDialog } from "@/components/taxonomy-item-dialog";
import { useHighlightParam } from "@/hooks/use-highlight-param";
import { tagDotColor } from "@/lib/tag-colors";
import { cn, truncateMiddle } from "@/lib/utils";
import type { Tag } from "@/lib/api-server";
import { bff } from "@/lib/bff";

const dateFormatter = new Intl.DateTimeFormat("de-DE", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

/** Ersetzt die generische `TaxonomyManager`-Tabelle für Tags durch eine
 * eigene Ansicht (Nutzervorgabe, 2026-08-16, 1:1 nach Bildvorlage):
 * Übersichtsleiste aller Tags als farbige Pills + Tabelle mit
 * Verwendungs-Anzahl (Medien), Erstelldatum und immer sichtbaren
 * Bearbeiten-/Löschen-Icon-Buttons statt Kebab-Menü. Kategorien nutzen
 * weiterhin die generische `TaxonomyManager`-Tabelle. */
export function TagsManager({
  allTags,
  items,
}: {
  allTags: Tag[];
  items: Tag[];
}) {
  const router = useRouter();
  const { activeId, query: highlightQuery } = useHighlightParam("taxonomy-row");
  const [editTarget, setEditTarget] = useState<Tag | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Tag | null>(null);

  async function handleDelete() {
    if (!deleteTarget) return;
    await fetch(bff(`/api/tags/${deleteTarget.id}`), { method: "DELETE" });
    toastDeleted(`„${deleteTarget.name}“ wurde gelöscht.`);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-[10px] bg-card p-6 shadow-sm">
        <p className="mb-3 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          Alle Tags
        </p>
        {allTags.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Noch keine Tags vorhanden.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {allTags.map((tag) => (
              <span
                key={tag.id}
                className="flex items-center gap-2 rounded-full border bg-card px-3 py-1.5 text-sm"
              >
                <span
                  className={cn(
                    "size-2 shrink-0 rounded-full",
                    tagDotColor(tag.id),
                  )}
                />
                <span className="font-medium">{tag.name}</span>
                <span className="flex min-w-5 items-center justify-center rounded-full bg-muted px-1.5 text-xs text-muted-foreground">
                  {tag.mediaCount}
                </span>
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="overflow-hidden rounded-[10px] bg-card shadow-[0_1px_3px_0_rgba(0,0,0,0.1),0_1px_2px_-1px_rgba(0,0,0,0.1),0_-1px_2px_0_rgba(0,0,0,0.05)]">
        <Table>
          <TableHeader>
            <TableRow>
              {/* "Verwendet in" ist eine gezählte Anzahl verknüpfter
                  Medien – danach zu sortieren hieße, alle Schlagworte samt
                  ihren Verknüpfungen zu laden. */}
              <SortableHead field="name">Tag</SortableHead>
              <TableHead>Verwendet in</TableHead>
              <SortableHead field="createdAt">Erstellt</SortableHead>
              <TableHead className="text-center">Aktionen</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={4}
                  className="h-24 text-center text-muted-foreground"
                >
                  Noch keine Tags vorhanden.
                </TableCell>
              </TableRow>
            ) : (
              items.map((tag) => (
                <TableRow key={tag.id} id={`taxonomy-row-${tag.id}`}>
                  <TableCell className="font-medium">
                    <span className="flex items-center gap-2">
                      <span
                        className={cn(
                          "size-2 shrink-0 rounded-full",
                          tagDotColor(tag.id),
                        )}
                      />
                      <HighlightText
                        text={tag.name}
                        query={highlightQuery}
                        active={activeId === tag.id}
                      />
                    </span>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {tag.mediaCount}{" "}
                    {tag.mediaCount === 1 ? "Medium" : "Medien"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {dateFormatter.format(new Date(tag.createdAt))}
                  </TableCell>
                  <TableCell>
                    <RowActionButtons
                      onEdit={() => setEditTarget(tag)}
                      onDelete={() => setDeleteTarget(tag)}
                      editLabel={`„${tag.name}“ bearbeiten`}
                      deleteLabel={`„${tag.name}“ löschen`}
                    />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <TaxonomyItemDialog
        apiPath="tags"
        item={editTarget ?? undefined}
        newLabel="Neuer Tag"
        entitySingular="Tag"
        hideTrigger
        open={editTarget !== null}
        onOpenChange={(open) => !open && setEditTarget(null)}
      />

      <ConfirmDeleteDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title={`„${truncateMiddle(deleteTarget?.name ?? "")}“ löschen?`}
        description="Wird in den Papierkorb verschoben und kann von dort wiederhergestellt werden."
        onConfirm={handleDelete}
      />
    </div>
  );
}
