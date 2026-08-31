"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { toastEdited } from "@/components/app-toast";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getIndentedFolderOptions } from "@/lib/media-folders";
import type { MediaFolder } from "@/lib/api-server";
import { bff } from "@/lib/bff";

export function MoveToFolderDialog({
  trigger,
  folders,
  mediaIds,
  onSuccess,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
}: {
  /** Weggelassen = vollständig extern gesteuert über `open`/`onOpenChange`, kein eigener Trigger. */
  trigger?: React.ReactElement;
  folders: MediaFolder[];
  mediaIds: string[];
  onSuccess?: () => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const router = useRouter();
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = controlledOnOpenChange ?? setInternalOpen;
  const [folderId, setFolderId] = useState("root");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const folderOptions = getIndentedFolderOptions(folders);

  async function handleMove() {
    setError(null);
    setIsSubmitting(true);
    try {
      await Promise.all(
        mediaIds.map((id) =>
          fetch(bff(`/api/media/${id}`), {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              folderId: folderId === "root" ? null : folderId,
            }),
          }),
        ),
      );
      setOpen(false);
      onSuccess?.();
      toastEdited(
        mediaIds.length > 1
          ? `${mediaIds.length} Medien wurden verschoben.`
          : "Das Medium wurde verschoben.",
      );
      router.refresh();
    } catch {
      setError("Server nicht erreichbar. Bitte später erneut versuchen.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          setFolderId("root");
          setError(null);
        }
      }}
    >
      {trigger && <DialogTrigger render={trigger} />}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {mediaIds.length > 1
              ? `${mediaIds.length} Medien verschieben`
              : "Medium verschieben"}
          </DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <Select
            value={folderId}
            onValueChange={(value) => setFolderId(value ?? "root")}
            items={{
              root: "Kein Ordner (Root)",
              ...Object.fromEntries(
                folderOptions.map((option) => [option.id, option.label]),
              ),
            }}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="root">Kein Ordner (Root)</SelectItem>
              {folderOptions.map((option) => (
                <SelectItem key={option.id} value={option.id}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              className="border-border"
              onClick={() => setOpen(false)}
            >
              Abbrechen
            </Button>
            <Button type="button" onClick={handleMove} disabled={isSubmitting}>
              {isSubmitting ? "Verschiebt…" : "Verschieben"}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
