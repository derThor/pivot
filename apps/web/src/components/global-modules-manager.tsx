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
import { GlobalModuleFormDialog } from "@/components/global-module-form-dialog";
import { HighlightText } from "@/components/highlight-text";
import { SelectionToolbar } from "@/components/selection-toolbar";
import { useSelection } from "@/hooks/use-selection";
import { useHighlightParam } from "@/hooks/use-highlight-param";
import type { GlobalModule, ModuleType } from "@/lib/api-server";
import { truncateMiddle } from "@/lib/utils";
import { bff } from "@/lib/bff";

export function GlobalModulesManager({
  items,
  moduleType,
  entityLabelPlural = "Einträge",
}: {
  items: GlobalModule[];
  // Bearbeiten öffnet ein Popup (siehe global-module-form-dialog.tsx)
  // statt einer eigenen Seite.
  moduleType: ModuleType;
  entityLabelPlural?: string;
}) {
  const router = useRouter();
  const { activeId, query: highlightQuery } =
    useHighlightParam("global-module-row");
  const [editTarget, setEditTarget] = useState<GlobalModule | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<GlobalModule | null>(null);
  const {
    selected,
    toggle,
    toggleAll,
    clear,
    allSelected,
    someSelected,
    count,
  } = useSelection(items.map((item) => item.id));

  async function handleDelete() {
    if (!deleteTarget) return;
    await fetch(bff(`/api/global-modules/${deleteTarget.id}`), {
      method: "DELETE",
    });
    router.refresh();
  }

  async function handleBulkDelete() {
    await Promise.all(
      [...selected].map((id) =>
        fetch(bff(`/api/global-modules/${id}`), { method: "DELETE" }),
      ),
    );
    clear();
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-3">
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
              <TableHead>Zuletzt geändert</TableHead>
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
                  Noch keine Einträge angelegt.
                </TableCell>
              </TableRow>
            ) : (
              items.map((item) => (
                <TableRow key={item.id} id={`global-module-row-${item.id}`}>
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
                  <TableCell>
                    {new Date(item.updatedAt).toLocaleString("de-DE")}
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-center">
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          render={
                            <Button
                              type="button"
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
                          <DropdownMenuItem onClick={() => setEditTarget(item)}>
                            <Pencil />
                            Bearbeiten
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            variant="destructive"
                            onClick={() => setDeleteTarget(item)}
                          >
                            <Trash2 />
                            Löschen
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {editTarget && (
        <GlobalModuleFormDialog
          moduleType={moduleType}
          globalModule={editTarget}
          hideTrigger
          open={editTarget !== null}
          onOpenChange={(open) => !open && setEditTarget(null)}
        />
      )}

      <ConfirmDeleteDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title={`„${truncateMiddle(deleteTarget?.name ?? "")}“ löschen?`}
        description="Wird aus allen Seiten entfernt, die es einbinden, und in den Papierkorb verschoben, von wo es wiederhergestellt werden kann."
        onConfirm={handleDelete}
      />
    </div>
  );
}
