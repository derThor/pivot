"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MoreVertical, Pencil, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ConfirmDeleteDialog } from "@/components/confirm-delete-dialog";
import { SelectionToolbar } from "@/components/selection-toolbar";
import { TaxonomyItemDialog } from "@/components/taxonomy-item-dialog";
import { useSelection } from "@/hooks/use-selection";
import type { TaxonomyItem } from "@/lib/api-server";

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
    <div className="flex justify-end">
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="ghost"
              size="icon-sm"
              className="rounded-full"
              aria-label={`Aktionen für ${item.name}`}
            />
          }
        >
          <MoreVertical />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => setEditOpen(true)}>
            <Pencil />
            Bearbeiten
          </DropdownMenuItem>
          <DropdownMenuItem variant="destructive" onClick={() => setDeleteOpen(true)}>
            <Trash2 />
            Löschen
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

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
        title={`„${item.name}“ löschen?`}
        description="Diese Aktion kann nicht rückgängig gemacht werden."
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
  const { selected, toggle, toggleAll, clear, allSelected, someSelected, count } =
    useSelection(items.map((item) => item.id));

  async function handleDelete(id: string) {
    await fetch(`/api/${apiPath}/${id}`, { method: "DELETE" });
    router.refresh();
  }

  async function handleBulkDelete() {
    await Promise.all(
      [...selected].map((id) =>
        fetch(`/api/${apiPath}/${id}`, { method: "DELETE" }),
      ),
    );
    clear();
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-4">
      <SelectionToolbar
        count={count}
        entityLabelPlural={entityLabelPlural}
        onDelete={handleBulkDelete}
        onClear={clear}
      />
      <div className="rounded-2xl bg-card shadow-card overflow-hidden">
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
              <TableHead className="text-right">Aktionen</TableHead>
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
                <TableRow key={item.id}>
                  <TableCell>
                    <Checkbox
                      checked={selected.has(item.id)}
                      onCheckedChange={() => toggle(item.id)}
                      aria-label={`${item.name} auswählen`}
                    />
                  </TableCell>
                  <TableCell className="font-medium">{item.name}</TableCell>
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
