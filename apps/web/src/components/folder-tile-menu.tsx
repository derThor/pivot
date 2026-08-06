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
import { FolderDialog } from "@/components/folder-dialog";
import type { MediaFolder } from "@/lib/api-server";

export function FolderTileMenu({ folder }: { folder: MediaFolder }) {
  const router = useRouter();
  const [renameOpen, setRenameOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const isEmpty = folder.mediaCount === 0 && folder.childCount === 0;

  async function handleDelete() {
    await fetch(`/api/media-folders/${folder.id}`, { method: "DELETE" });
    router.refresh();
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`Aktionen für ${folder.name}`}
            />
          }
        >
          <MoreVertical />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => setRenameOpen(true)}>
            <Pencil />
            Umbenennen
          </DropdownMenuItem>
          <DropdownMenuItem
            variant="destructive"
            disabled={folder.isSystem}
            onClick={() => setDeleteOpen(true)}
          >
            <Trash2 />
            {folder.isSystem ? "Löschen (Systemordner)" : "Löschen"}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <FolderDialog
        folder={folder}
        hideTrigger
        open={renameOpen}
        onOpenChange={setRenameOpen}
      />
      <ConfirmDeleteDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={`„${folder.name}“ löschen?`}
        description={
          isEmpty
            ? "Diese Aktion kann nicht rückgängig gemacht werden."
            : "Dieser Ordner enthält Dateien und/oder Unterordner. Alle enthaltenen Unterordner und Medien werden unwiderruflich mitgelöscht – diese Aktion kann nicht rückgängig gemacht werden."
        }
        onConfirm={handleDelete}
      />
    </>
  );
}
