"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MoreVertical, Pencil, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ConfirmDeleteDialog } from "@/components/confirm-delete-dialog";
import { RoleFormDialog } from "@/components/role-form-dialog";
import type { Role } from "@/lib/api-server";

export function RoleRowActions({
  role,
  permissionsCatalog,
}: {
  role: Role;
  permissionsCatalog: string[];
}) {
  const router = useRouter();
  const canDelete = !role.isSystem && role.userCount === 0;
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  async function handleDelete() {
    await fetch(`/api/roles/${role.id}`, { method: "DELETE" });
    router.refresh();
  }

  return (
    <div className="flex justify-end">
      <div className="hidden items-center gap-1 md:flex">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={`${role.name} bearbeiten`}
          onClick={() => setEditOpen(true)}
        >
          <Pencil />
        </Button>
        {canDelete && (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={`${role.name} löschen`}
            onClick={() => setDeleteOpen(true)}
          >
            <Trash2 />
          </Button>
        )}
      </div>

      <div className="md:hidden">
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="ghost"
                size="icon-sm"
                className="rounded-full"
                aria-label={`Aktionen für ${role.name}`}
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
            {canDelete && (
              <DropdownMenuItem
                variant="destructive"
                onClick={() => setDeleteOpen(true)}
              >
                <Trash2 />
                Löschen
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <RoleFormDialog
        role={role}
        permissionsCatalog={permissionsCatalog}
        hideTrigger
        open={editOpen}
        onOpenChange={setEditOpen}
      />

      {canDelete && (
        <ConfirmDeleteDialog
          open={deleteOpen}
          onOpenChange={setDeleteOpen}
          title={`„${role.name}“ löschen?`}
          description="Diese Aktion kann nicht rückgängig gemacht werden."
          onConfirm={handleDelete}
        />
      )}
    </div>
  );
}
