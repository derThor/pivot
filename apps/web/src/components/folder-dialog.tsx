"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FolderPlus, Pencil } from "lucide-react";

import { toastCreated, toastEdited } from "@/components/app-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { MediaFolder } from "@/lib/api-server";

export function FolderDialog({
  parentId,
  folder,
  hideTrigger,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
}: {
  /** Bei Anlegen: Ziel-Elternordner (null = Root). Bei Umbenennen: ignoriert. */
  parentId?: string | null;
  /** Wenn gesetzt: Umbenennen-Modus statt Anlegen. */
  folder?: MediaFolder;
  /** Kein eigener Trigger – erwartet `open`/`onOpenChange` von außen (z.B. aus einem Dropdown-Menü). */
  hideTrigger?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const router = useRouter();
  const isEditing = Boolean(folder);
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = controlledOnOpenChange ?? setInternalOpen;
  const [name, setName] = useState(folder?.name ?? "");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      const res = await fetch(
        isEditing ? `/api/media-folders/${folder!.id}` : "/api/media-folders",
        {
          method: isEditing ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            isEditing ? { name } : { name, parentId: parentId ?? undefined },
          ),
        },
      );

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setError(body?.message ?? "Konnte nicht gespeichert werden.");
        return;
      }

      setOpen(false);
      if (!isEditing) setName("");
      if (isEditing) toastEdited(`„${name}“ wurde gespeichert.`);
      else toastCreated(`„${name}“ wurde angelegt.`);
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
          setError(null);
          setName(folder?.name ?? "");
        }
      }}
    >
      {!hideTrigger && (
        <DialogTrigger
          render={
            isEditing ? (
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`${folder!.name} umbenennen`}
              />
            ) : (
              <Button variant="outline" />
            )
          }
        >
          {isEditing ? (
            <Pencil />
          ) : (
            <>
              <FolderPlus />
              Neuer Ordner
            </>
          )}
        </DialogTrigger>
      )}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Ordner umbenennen" : "Neuer Ordner"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="folder-name">Name</Label>
            <Input
              id="folder-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoFocus
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Speichert…" : "Speichern"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
