"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Pencil, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ConfirmDeleteDialog } from "@/components/confirm-delete-dialog";

export function ContentRowActions({
  id,
  title,
}: {
  id: string;
  title: string;
}) {
  const router = useRouter();

  async function handleDelete() {
    await fetch(`/api/content/${id}`, { method: "DELETE" });
    router.refresh();
  }

  return (
    <div className="flex justify-end gap-1">
      <Button
        variant="ghost"
        size="icon-sm"
        render={<Link href={`/dashboard/content/${id}/edit`} />}
        aria-label={`${title} bearbeiten`}
      >
        <Pencil />
      </Button>
      <ConfirmDeleteDialog
        trigger={
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`${title} löschen`}
          >
            <Trash2 />
          </Button>
        }
        title={`„${title}“ löschen?`}
        description="Diese Aktion kann nicht rückgängig gemacht werden."
        onConfirm={handleDelete}
      />
    </div>
  );
}
