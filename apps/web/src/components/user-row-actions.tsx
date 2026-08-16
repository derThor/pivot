"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { toastEdited } from "@/components/app-toast";
import { ConfirmDeleteDialog } from "@/components/confirm-delete-dialog";
import { RowActionButtons } from "@/components/row-action-buttons";
import { EditUserDialog } from "@/components/edit-user-dialog";
import type { CurrentUser, Role } from "@/lib/api-server";
import { formatName } from "@/lib/utils";

export function UserRowActions({
  user,
  isSelf,
  allowEmailChange,
  roles,
}: {
  user: CurrentUser;
  isSelf: boolean;
  allowEmailChange: boolean;
  roles: Role[];
}) {
  const router = useRouter();
  const name = formatName(user);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  // Deaktiviert den Zugriff (Soft-Delete, siehe UsersService.remove) statt
  // den Account wirklich zu löschen – über den "Bearbeiten"-Dialog jederzeit
  // wieder reaktivierbar.
  async function handleDeactivate() {
    await fetch(`/api/users/${user.id}`, { method: "DELETE" });
    toastEdited(`„${name}“ wurde deaktiviert.`);
    router.refresh();
  }

  return (
    <div className="flex justify-center">
      <RowActionButtons
        onEdit={() => setEditOpen(true)}
        onDelete={!isSelf ? () => setDeleteOpen(true) : undefined}
        editLabel={`„${name}“ bearbeiten`}
        deleteLabel={`„${name}“ deaktivieren`}
      />

      <EditUserDialog
        user={user}
        allowEmailChange={allowEmailChange}
        roles={roles}
        hideTrigger
        open={editOpen}
        onOpenChange={setEditOpen}
      />

      {!isSelf && (
        <ConfirmDeleteDialog
          open={deleteOpen}
          onOpenChange={setDeleteOpen}
          title={`„${name}“ deaktivieren?`}
          description="Der Zugriff wird sofort entzogen. Über „Bearbeiten“ lässt sich das Konto jederzeit wieder aktivieren."
          onConfirm={handleDeactivate}
        />
      )}
    </div>
  );
}
