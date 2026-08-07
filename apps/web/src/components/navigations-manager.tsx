"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, MoreVertical, Pencil, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
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
import { NavigationDialog } from "@/components/navigation-dialog";
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
    router.refresh();
  }

  return (
    <div className="rounded-2xl bg-card shadow-card overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Slug</TableHead>
            <TableHead>Einträge</TableHead>
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
                Noch keine Navigationen vorhanden.
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
                  <div className="flex justify-end">
                    <div className="hidden items-center gap-1 md:flex">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`${navigation.name} öffnen`}
                        render={
                          <Link href={`/dashboard/navigation/${navigation.id}`} />
                        }
                      >
                        <ArrowRight />
                      </Button>
                      <NavigationDialog navigation={navigation} />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`${navigation.name} löschen`}
                        onClick={() => setDeleteTarget(navigation)}
                      >
                        <Trash2 />
                      </Button>
                    </div>

                    <div className="md:hidden">
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          render={
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              className="rounded-full"
                              aria-label={`Aktionen für ${navigation.name}`}
                            />
                          }
                        >
                          <MoreVertical />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            render={
                              <Link href={`/dashboard/navigation/${navigation.id}`} />
                            }
                          >
                            <ArrowRight />
                            Öffnen
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setEditOpenId(navigation.id)}>
                            <Pencil />
                            Bearbeiten
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            variant="destructive"
                            onClick={() => setDeleteTarget(navigation)}
                          >
                            <Trash2 />
                            Löschen
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                      <NavigationDialog
                        navigation={navigation}
                        hideTrigger
                        open={editOpenId === navigation.id}
                        onOpenChange={(next) =>
                          setEditOpenId(next ? navigation.id : null)
                        }
                      />
                    </div>
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
        title={`Navigation „${deleteTarget?.name}“ löschen?`}
        description="Alle Einträge dieser Navigation werden mitgelöscht. Diese Aktion kann nicht rückgängig gemacht werden."
        onConfirm={handleDelete}
      />
    </div>
  );
}
