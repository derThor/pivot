"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";

import { toastDeleted } from "@/components/app-toast";
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
import { NavigationDialog } from "@/components/navigation-dialog";
import { RowActionButtons } from "@/components/row-action-buttons";
import type { NavigationSummary } from "@/lib/api-server";

export function NavigationsManager({ items }: { items: NavigationSummary[] }) {
  const router = useRouter();
  const [editOpenId, setEditOpenId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<NavigationSummary | null>(
    null,
  );

  async function handleDelete() {
    if (!deleteTarget) return;
    await fetch(`/api/navigations/${deleteTarget.id}`, { method: "DELETE" });
    toastDeleted(`Menü „${deleteTarget.name}“ wurde gelöscht.`);
    router.refresh();
  }

  return (
    <div className="overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Slug</TableHead>
            <TableHead>Einträge</TableHead>
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
                Noch keine Menüs vorhanden.
              </TableCell>
            </TableRow>
          ) : (
            items.map((navigation) => (
              <TableRow key={navigation.id}>
                <TableCell className="font-medium">
                  <Link
                    href={`/dashboard/navigation/${navigation.id}`}
                    className="hover:underline"
                  >
                    {navigation.name}
                  </Link>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {navigation.slug}
                </TableCell>
                <TableCell>{navigation._count.items}</TableCell>
                <TableCell>
                  <div className="flex justify-center">
                    <RowActionButtons
                      onEdit={() => setEditOpenId(navigation.id)}
                      onDelete={() => setDeleteTarget(navigation)}
                      editLabel={`„${navigation.name}“ bearbeiten`}
                      deleteLabel={`„${navigation.name}“ löschen`}
                      extra={
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="rounded-lg border-[#D4D4D4]"
                          render={<Link href={`/dashboard/navigation/${navigation.id}`} />}
                          aria-label={`„${navigation.name}“ öffnen`}
                        >
                          <ArrowRight />
                        </Button>
                      }
                    />
                    <NavigationDialog
                      navigation={navigation}
                      hideTrigger
                      open={editOpenId === navigation.id}
                      onOpenChange={(next) =>
                        setEditOpenId(next ? navigation.id : null)
                      }
                    />
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
        title={`Menü „${deleteTarget?.name}“ löschen?`}
        description="Alle Einträge dieses Menüs werden mitgelöscht. Diese Aktion kann nicht rückgängig gemacht werden."
        onConfirm={handleDelete}
      />
    </div>
  );
}
