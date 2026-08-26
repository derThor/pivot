"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { toastDeleted } from "@/components/app-toast";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ConfirmDeleteDialog } from "@/components/confirm-delete-dialog";
import { RowActionButtons } from "@/components/row-action-buttons";
import { HighlightText } from "@/components/highlight-text";
import { SelectionToolbar } from "@/components/selection-toolbar";
import { TaxonomyItemDialog } from "@/components/taxonomy-item-dialog";
import { useSelection } from "@/hooks/use-selection";
import { useHighlightParam } from "@/hooks/use-highlight-param";
import type { TaxonomyItem } from "@/lib/api-server";
import { truncateMiddle } from "@/lib/utils";

function TaxonomyRowActions({
  apiPath,
  withDescription,
  item,
  newLabel,
  entitySingular,
  onDelete,
}: {
  apiPath: "categories" | "tags";
  withDescription?: boolean;
  item: TaxonomyItem;
  newLabel: string;
  entitySingular: string;
  onDelete: () => void;
}) {
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  return (
    <div className="flex justify-center">
      <RowActionButtons
        onEdit={() => setEditOpen(true)}
        onDelete={() => setDeleteOpen(true)}
        editLabel={`„${item.name}“ bearbeiten`}
        deleteLabel={`„${item.name}“ löschen`}
      />

      <TaxonomyItemDialog
        apiPath={apiPath}
        withDescription={withDescription}
        item={item}
        newLabel={newLabel}
        entitySingular={entitySingular}
        hideTrigger
        open={editOpen}
        onOpenChange={setEditOpen}
      />

      <ConfirmDeleteDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={`„${truncateMiddle(item.name)}“ löschen?`}
        description="Wird in den Papierkorb verschoben und kann von dort wiederhergestellt werden."
        onConfirm={onDelete}
      />
    </div>
  );
}

export function TaxonomyManager({
  apiPath,
  items,
  withDescription,
  newLabel,
  entitySingular,
  entityLabelPlural,
}: {
  apiPath: "categories" | "tags";
  items: TaxonomyItem[];
  withDescription?: boolean;
  newLabel: string;
  entitySingular: string;
  entityLabelPlural: string;
}) {
  const router = useRouter();
  const { activeId, query: highlightQuery } = useHighlightParam("taxonomy-row");
  const {
    selected,
    toggle,
    toggleAll,
    clear,
    allSelected,
    someSelected,
    count,
  } = useSelection(items.map((item) => item.id));

  async function handleDelete(id: string) {
    const item = items.find((i) => i.id === id);
    await fetch(`/api/${apiPath}/${id}`, { method: "DELETE" });
    toastDeleted(item ? `„${item.name}“ wurde gelöscht.` : undefined);
    router.refresh();
  }

  async function handleBulkDelete() {
    const deletedCount = selected.size;
    await Promise.all(
      [...selected].map((id) =>
        fetch(`/api/${apiPath}/${id}`, { method: "DELETE" }),
      ),
    );
    clear();
    toastDeleted(`${deletedCount} ${entityLabelPlural} wurden gelöscht.`);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-4">
      <SelectionToolbar
        count={count}
        entityLabelPlural={entityLabelPlural}
        onDelete={handleBulkDelete}
        onClear={clear}
        confirmDescription="Wird in den Papierkorb verschoben und kann von dort wiederhergestellt werden."
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
              <TableHead>Name</TableHead>
              <TableHead>Slug</TableHead>
              {withDescription && <TableHead>Beschreibung</TableHead>}
              <TableHead className="text-center">Aktionen</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={withDescription ? 5 : 4}
                  className="h-24 text-center text-muted-foreground"
                >
                  Noch keine Einträge vorhanden.
                </TableCell>
              </TableRow>
            ) : (
              items.map((item) => (
                <TableRow key={item.id} id={`taxonomy-row-${item.id}`}>
                  <TableCell>
                    <Checkbox
                      checked={selected.has(item.id)}
                      onCheckedChange={() => toggle(item.id)}
                      aria-label={`${item.name} auswählen`}
                    />
                  </TableCell>
                  <TableCell className="font-medium">
                    <HighlightText
                      text={item.name}
                      query={highlightQuery}
                      active={activeId === item.id}
                    />
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {item.slug}
                  </TableCell>
                  {withDescription && (
                    <TableCell className="text-muted-foreground">
                      {item.description || "—"}
                    </TableCell>
                  )}
                  <TableCell>
                    <TaxonomyRowActions
                      apiPath={apiPath}
                      withDescription={withDescription}
                      item={item}
                      newLabel={newLabel}
                      entitySingular={entitySingular}
                      onDelete={() => handleDelete(item.id)}
                    />
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
