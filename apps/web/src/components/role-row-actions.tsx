"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { toastDeleted } from "@/components/app-toast";
import { ConfirmDeleteDialog } from "@/components/confirm-delete-dialog";
import { RowActionButtons } from "@/components/row-action-buttons";
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
    toastDeleted(`„${role.name}“ wurde gelöscht.`);
    router.refresh();
  }

  return (
    <div className="flex justify-center">
      <RowActionButtons
        onEdit={() => setEditOpen(true)}
        onDelete={canDelete ? () => setDeleteOpen(true) : undefined}
        editLabel={`„${role.name}“ bearbeiten`}
        deleteLabel={`„${role.name}“ löschen`}
      />

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
