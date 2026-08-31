"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { toastDeleted } from "@/components/app-toast";
import { ConfirmDeleteDialog } from "@/components/confirm-delete-dialog";
import { RowActionButtons } from "@/components/row-action-buttons";
import { truncateMiddle } from "@/lib/utils";
import { bff } from "@/lib/bff";

export function FormRowActions({ id, name }: { id: string; name: string }) {
  const router = useRouter();
  const [deleteOpen, setDeleteOpen] = useState(false);

  async function handleDelete() {
    await fetch(bff(`/api/forms/${id}`), { method: "DELETE" });
    toastDeleted(`„${name}“ wurde gelöscht.`);
    router.refresh();
  }

  return (
    <div className="flex justify-center">
      <RowActionButtons
        onEdit={() => router.push(`/dashboard/forms/${id}`)}
        onDelete={() => setDeleteOpen(true)}
        editLabel={`„${name}“ bearbeiten`}
        deleteLabel={`„${name}“ löschen`}
      />

      <ConfirmDeleteDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={`„${truncateMiddle(name)}“ löschen?`}
        description="Wird in den Papierkorb verschoben und kann von dort wiederhergestellt werden."
        onConfirm={handleDelete}
      />
    </div>
  );
}
