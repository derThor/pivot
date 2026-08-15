"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye } from "lucide-react";

import { toastDeleted } from "@/components/app-toast";
import { Button } from "@/components/ui/button";
import { ConfirmDeleteDialog } from "@/components/confirm-delete-dialog";
import { RowActionButtons } from "@/components/row-action-buttons";

export function ContentRowActions({
  id,
  title,
}: {
  id: string;
  title: string;
}) {
  const router = useRouter();
  const [deleteOpen, setDeleteOpen] = useState(false);

  async function handleDelete() {
    await fetch(`/api/content/${id}`, { method: "DELETE" });
    toastDeleted(`„${title}“ wurde gelöscht.`);
    router.refresh();
  }

  return (
    <div className="flex justify-center">
      <RowActionButtons
        onEdit={() => router.push(`/dashboard/content/${id}/edit`)}
        onDelete={() => setDeleteOpen(true)}
        editLabel={`„${title}“ bearbeiten`}
        deleteLabel={`„${title}“ löschen`}
        extra={
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="rounded-lg border-[#D4D4D4]"
            render={<Link href={`/dashboard/content/${id}/preview`} target="_blank" />}
            aria-label={`Vorschau von „${title}“ öffnen`}
          >
            <Eye />
          </Button>
        }
      />

      <ConfirmDeleteDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={`„${title}“ löschen?`}
        description="Diese Aktion kann nicht rückgängig gemacht werden."
        onConfirm={handleDelete}
      />
    </div>
  );
}
