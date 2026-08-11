"use client";

import { useState } from "react";
import Link from "next/link";
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
import type { GlobalModule } from "@/lib/api-server";

export function GlobalModulesManager({
  items,
  editHrefBase,
}: {
  items: GlobalModule[];
  // Bearbeiten öffnet `${editHrefBase}/${item.id}` als eigene Seite (mehr
  // Platz, siehe global-module-page-form.tsx). Bewusst ein String statt
  // einer Callback-Funktion: diese Komponente wird von einer Server
  // Component aus verwendet, Funktionen lassen sich über die RSC-Grenze
  // nicht übergeben ("Functions cannot be passed directly to Client
  // Components").
  editHrefBase: string;
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
            <TableHead>Zuletzt geändert</TableHead>
            <TableHead className="text-right">Aktionen</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={3}
                className="h-24 text-center text-muted-foreground"
              >
                Noch keine Einträge angelegt.
              </TableCell>
            </TableRow>
          ) : (
            items.map((item) => (
              <TableRow key={item.id}>
                <TableCell className="font-medium">{item.name}</TableCell>
                <TableCell>
                  {new Date(item.updatedAt).toLocaleString("de-DE")}
                </TableCell>
                <TableCell>
                  <div className="flex justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`${item.name} bearbeiten`}
                      render={<Link href={`${editHrefBase}/${item.id}`} />}
                    >
                      <Pencil />
                    </Button>
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
        title={`„${deleteTarget?.name}“ löschen?`}
        description="Wird aus allen Seiten entfernt, die es einbinden. Diese Aktion kann nicht rückgängig gemacht werden."
        onConfirm={handleDelete}
      />
    </div>
  );
}
