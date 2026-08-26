"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Lock, MoreVertical, Pencil, Trash2 } from "lucide-react";

import { toastDeleted } from "@/components/app-toast";
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
import { truncateMiddle } from "@/lib/utils";

export function FolderTileMenu({ folder }: { folder: MediaFolder }) {
  const router = useRouter();
  const [renameOpen, setRenameOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const isEmpty = folder.mediaCount === 0 && folder.childCount === 0;

  async function handleDelete() {
    await fetch(`/api/media-folders/${folder.id}`, { method: "DELETE" });
    toastDeleted(`„${folder.name}“ wurde gelöscht.`);
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
              className="size-6 rounded-full border border-border bg-background/90 shadow-sm hover:bg-background"
            />
          }
        >
          <MoreVertical className="size-3.5" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => setRenameOpen(true)}>
            <Pencil />
            Umbenennen
          </DropdownMenuItem>
          <DropdownMenuItem
            variant="destructive"
            disabled={folder.isSystem}
            title={
              folder.isSystem
                ? "Systemordner können nicht gelöscht werden."
                : undefined
            }
            onClick={() => setDeleteOpen(true)}
          >
            <Trash2 />
            Löschen
            {folder.isSystem && (
              <Lock className="ml-auto size-3.5 text-muted-foreground" />
            )}
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
        title={`„${truncateMiddle(folder.name)}“ löschen?`}
        description={
          isEmpty
            ? "Diese Aktion kann nicht rückgängig gemacht werden."
            : "Dieser Ordner enthält Dateien und/oder Unterordner. Alle enthaltenen Medien werden in den Papierkorb verschoben und können von dort wiederhergestellt werden – die Ordnerstruktur selbst kann nicht wiederhergestellt werden."
        }
        onConfirm={handleDelete}
      />
    </>
  );
}
