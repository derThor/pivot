"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye } from "lucide-react";

import { toastDeleted } from "@/components/app-toast";
import { Button } from "@/components/ui/button";
import { ConfirmDeleteDialog } from "@/components/confirm-delete-dialog";
import { RowActionButtons } from "@/components/row-action-buttons";
import { truncateMiddle } from "@/lib/utils";
import { bff } from "@/lib/bff";

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
    await fetch(bff(`/api/content/${id}`), { method: "DELETE" });
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
            className="rounded-lg border-border"
            render={
              <Link href={`/dashboard/content/${id}/preview`} target="_blank" />
            }
            aria-label={`Vorschau von „${title}“ öffnen`}
          >
            <Eye />
          </Button>
        }
      />

      <ConfirmDeleteDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={`„${truncateMiddle(title)}“ löschen?`}
        description="Wird in den Papierkorb verschoben und kann von dort wiederhergestellt werden."
        onConfirm={handleDelete}
      />
    </div>
  );
}
