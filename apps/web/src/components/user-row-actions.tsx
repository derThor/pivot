"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { toastDeleted } from "@/components/app-toast";
import { ConfirmDeleteDialog } from "@/components/confirm-delete-dialog";
import { RowActionButtons } from "@/components/row-action-buttons";
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
    toastDeleted(`„${name}“ wurde gelöscht.`);
    router.refresh();
  }

  return (
    <div className="flex justify-center">
      <RowActionButtons
        onEdit={() => setEditOpen(true)}
        onDelete={!isSelf ? () => setDeleteOpen(true) : undefined}
        editLabel={`„${name}“ bearbeiten`}
        deleteLabel={`„${name}“ löschen`}
      />

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
