"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ConfirmDeleteDialog } from "@/components/confirm-delete-dialog";
import { GlobalModuleDialog } from "@/components/global-module-dialog";
import type { GlobalModule, ModuleType } from "@/lib/api-server";

export function GlobalModulesManager({
  items,
  moduleTypes,
}: {
  items: GlobalModule[];
  moduleTypes: ModuleType[];
}) {
  const router = useRouter();
  const [deleteTarget, setDeleteTarget] = useState<GlobalModule | null>(null);

  async function handleDelete() {
    if (!deleteTarget) return;
    await fetch(`/api/global-modules/${deleteTarget.id}`, { method: "DELETE" });
    router.refresh();
  }

  return (
    <div className="overflow-hidden rounded-2xl bg-card shadow-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Modul-Typ</TableHead>
            <TableHead>Zuletzt geändert</TableHead>
            <TableHead className="text-right">Aktionen</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={4}
                className="h-24 text-center text-muted-foreground"
              >
                Noch keine globalen Module angelegt.
              </TableCell>
            </TableRow>
          ) : (
            items.map((item) => (
              <TableRow key={item.id}>
                <TableCell className="font-medium">{item.name}</TableCell>
                <TableCell>{item.moduleType.name}</TableCell>
                <TableCell>
                  {new Date(item.updatedAt).toLocaleString("de-DE")}
                </TableCell>
                <TableCell>
                  <div className="flex justify-end gap-1">
                    <GlobalModuleDialog
                      moduleTypes={moduleTypes}
                      globalModule={item}
                      triggerButtonProps={{
                        variant: "ghost",
                        size: "icon-sm",
                        "aria-label": `${item.name} bearbeiten`,
                      }}
                      triggerContent={<Pencil />}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`${item.name} löschen`}
                      onClick={() => setDeleteTarget(item)}
                    >
                      <Trash2 />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      <ConfirmDeleteDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title={`Globales Modul „${deleteTarget?.name}“ löschen?`}
        description="Wird aus allen Seiten entfernt, die es einbinden. Diese Aktion kann nicht rückgängig gemacht werden."
        onConfirm={handleDelete}
      />
    </div>
  );
}
