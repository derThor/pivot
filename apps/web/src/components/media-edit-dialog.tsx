"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Crop, FolderInput, Target } from "lucide-react";

import { toastEdited } from "@/components/app-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { MediaCropDialog } from "@/components/media-crop-dialog";
import { MediaFocalPointDialog } from "@/components/media-focal-point-dialog";
import { MoveToFolderDialog } from "@/components/move-to-folder-dialog";
import { isCroppableImage } from "@/lib/media";
import type { MediaFolder, MediaItem } from "@/lib/api-server";

/** Bündelt die bisher einzeln über ein ⋮-Menü erreichbaren Bearbeiten-
 * Aktionen (Alt-Text, Zuschneiden, Fokuspunkt, Verschieben) in einem
 * Popup (Nutzervorgabe, 2026-08-17) – Duplizieren/Löschen bleiben davon
 * getrennt über ein kleines Menü in `media-detail-panel.tsx`, da sie
 * keine "Bearbeiten"-Aktionen im engeren Sinn sind. Zuschneiden/
 * Fokuspunkt/Verschieben öffnen die jeweils bereits bestehenden,
 * kontrollierten Dialoge als zusätzliche Ebene über diesem Popup, statt
 * ihre Logik zu duplizieren. */
export function MediaEditDialog({
  item,
  folders,
  open,
  onOpenChange,
}: {
  item: MediaItem;
  folders: MediaFolder[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [alt, setAlt] = useState(item.alt ?? "");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cropOpen, setCropOpen] = useState(false);
  const [focalOpen, setFocalOpen] = useState(false);
  const [moveOpen, setMoveOpen] = useState(false);
  const croppable = isCroppableImage(item.mimeType);
  const currentFolder = folders.find((f) => f.id === item.folderId);

  async function handleSave(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setIsSaving(true);
    try {
      const res = await fetch(`/api/media/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ alt }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setError(body?.message ?? "Konnte nicht gespeichert werden.");
        return;
      }
      onOpenChange(false);
      toastEdited("Die Änderungen wurden gespeichert.");
      router.refresh();
    } catch {
      setError("Server nicht erreichbar. Bitte später erneut versuchen.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="min-w-0 truncate pr-6">
              „{item.filename}“ bearbeiten
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`alt-${item.id}`}>Alt-Text</Label>
              <Input
                id={`alt-${item.id}`}
                value={alt}
                onChange={(e) => setAlt(e.target.value)}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label>Ordner</Label>
              <div className="flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm">
                <span className="truncate text-muted-foreground">
                  {currentFolder?.name ?? "Kein Ordner"}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setMoveOpen(true)}
                >
                  <FolderInput />
                  Verschieben
                </Button>
              </div>
            </div>

            {croppable && (
              <div className="flex flex-col gap-1.5">
                <Label>Bild</Label>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setCropOpen(true)}
                  >
                    <Crop />
                    Zuschneiden
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setFocalOpen(true)}
                  >
                    <Target />
                    Fokuspunkt setzen
                  </Button>
                </div>
              </div>
            )}

            {error && <p className="text-sm text-destructive">{error}</p>}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Abbrechen
              </Button>
              <Button type="submit" disabled={isSaving}>
                {isSaving ? "Speichert…" : "Speichern"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <MoveToFolderDialog
        open={moveOpen}
        onOpenChange={setMoveOpen}
        folders={folders}
        mediaIds={[item.id]}
      />

      {croppable && (
        <>
          <MediaCropDialog item={item} open={cropOpen} onOpenChange={setCropOpen} />
          <MediaFocalPointDialog
            item={item}
            open={focalOpen}
            onOpenChange={setFocalOpen}
          />
        </>
      )}
    </>
  );
}
