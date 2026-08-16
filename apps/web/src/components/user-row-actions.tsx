"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { toastEdited } from "@/components/app-toast";
import { ConfirmDeleteDialog } from "@/components/confirm-delete-dialog";
import { RowActionButtons } from "@/components/row-action-buttons";
import type { CurrentUser } from "@/lib/api-server";
import { formatName } from "@/lib/utils";

export function UserRowActions({
  user,
  isSelf,
}: {
  user: CurrentUser;
  isSelf: boolean;
}) {
  const router = useRouter();
  const name = formatName(user);
  const [deleteOpen, setDeleteOpen] = useState(false);

  // Deaktiviert den Zugriff (Soft-Delete, siehe UsersService.remove) statt
  // den Account wirklich zu löschen – über die Bearbeiten-Seite jederzeit
  // wieder reaktivierbar.
  async function handleDeactivate() {
    await fetch(`/api/users/${user.id}`, { method: "DELETE" });
    toastEdited(`„${name}“ wurde deaktiviert.`);
    router.refresh();
  }

  return (
    <div className="flex justify-center">
      <RowActionButtons
        onEdit={() => router.push(`/dashboard/users/${user.id}/edit`)}
        onDelete={!isSelf ? () => setDeleteOpen(true) : undefined}
        editLabel={`„${name}“ bearbeiten`}
        deleteLabel={`„${name}“ deaktivieren`}
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
