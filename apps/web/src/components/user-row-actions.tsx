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
import { EditUserDialog } from "@/components/edit-user-dialog";
import type { CurrentUser } from "@/lib/api-server";
import { formatName } from "@/lib/utils";

export function UserRowActions({
  user,
  isSelf,
  allowEmailChange,
}: {
  user: CurrentUser;
  isSelf: boolean;
  allowEmailChange: boolean;
}) {
  const router = useRouter();
  const name = formatName(user);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  async function handleDelete() {
    await fetch(`/api/users/${user.id}`, { method: "DELETE" });
    router.refresh();
  }

  return (
    <div className="flex justify-end">
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="ghost"
              size="icon-sm"
              className="rounded-full"
              aria-label={`Aktionen für ${name}`}
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
          {!isSelf && (
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

      <EditUserDialog
        user={user}
        allowEmailChange={allowEmailChange}
        hideTrigger
        open={editOpen}
        onOpenChange={setEditOpen}
      />

      {!isSelf && (
        <ConfirmDeleteDialog
          open={deleteOpen}
          onOpenChange={setDeleteOpen}
          title={`„${name}“ löschen?`}
          description="Diese Aktion kann nicht rückgängig gemacht werden."
          onConfirm={handleDelete}
        />
      )}
    </div>
  );
}
