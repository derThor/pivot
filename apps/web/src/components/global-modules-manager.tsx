"use client";

import { useState } from "react";
import Link from "next/link";
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
import { useSelection } from "@/hooks/use-selection";
import type { GlobalModule } from "@/lib/api-server";

export function GlobalModulesManager({
  items,
  editHrefBase,
  entityLabelPlural = "Einträge",
}: {
  items: GlobalModule[];
  // Bearbeiten öffnet `${editHrefBase}/${item.id}` als eigene Seite (mehr
  // Platz, siehe global-module-page-form.tsx). Bewusst ein String statt
  // einer Callback-Funktion: diese Komponente wird von einer Server
  // Component aus verwendet, Funktionen lassen sich über die RSC-Grenze
  // nicht übergeben ("Functions cannot be passed directly to Client
  // Components").
  editHrefBase: string;
  entityLabelPlural?: string;
}) {
  const router = useRouter();
  const [deleteTarget, setDeleteTarget] = useState<GlobalModule | null>(null);
  const { selected, toggle, toggleAll, clear, allSelected, someSelected, count } =
    useSelection(items.map((item) => item.id));

  async function handleDelete() {
    if (!deleteTarget) return;
    await fetch(`/api/global-modules/${deleteTarget.id}`, { method: "DELETE" });
    router.refresh();
  }

  async function handleBulkDelete() {
    await Promise.all(
      [...selected].map((id) =>
        fetch(`/api/global-modules/${id}`, { method: "DELETE" }),
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
                <TableRow key={item.id}>
                  <TableCell>
                    <Checkbox
                      checked={selected.has(item.id)}
                      onCheckedChange={() => toggle(item.id)}
                      aria-label={`${item.name} auswählen`}
                    />
                  </TableCell>
                  <TableCell className="font-medium">{item.name}</TableCell>
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
                          <DropdownMenuItem
                            render={<Link href={`${editHrefBase}/${item.id}`} />}
                          >
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

      <ConfirmDeleteDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title={`„${deleteTarget?.name}“ löschen?`}
        description="Wird aus allen Seiten entfernt, die es einbinden. Diese Aktion kann nicht rückgängig gemacht werden."
        onConfirm={handleDelete}
      />
    </div>
  );
}
