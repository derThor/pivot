"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Copy, Crop, FolderInput, MoreVertical, Pencil, Tag, Target, Trash2 } from "lucide-react";

import { toastCreated, toastDeleted, toastEdited } from "@/components/app-toast";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ConfirmDeleteDialog } from "@/components/confirm-delete-dialog";
import { MoveToFolderDialog } from "@/components/move-to-folder-dialog";
import { MediaCropDialog } from "@/components/media-crop-dialog";
import { MediaFocalPointDialog } from "@/components/media-focal-point-dialog";
import { MediaTagsDialog } from "@/components/media-tags-dialog";
import type { MediaFolder, MediaItem, TaxonomyItem } from "@/lib/api-server";
import { isCroppableImage } from "@/lib/media";

export function MediaCardActions({
  item,
  folders,
  availableTags = [],
}: {
  item: MediaItem;
  folders: MediaFolder[];
  availableTags?: TaxonomyItem[];
}) {
  const router = useRouter();
  const [altOpen, setAltOpen] = useState(false);
  const [moveOpen, setMoveOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [cropOpen, setCropOpen] = useState(false);
  const [focalOpen, setFocalOpen] = useState(false);
  const [tagsOpen, setTagsOpen] = useState(false);
  const [alt, setAlt] = useState(item.alt ?? "");
  const [isSaving, setIsSaving] = useState(false);
  const [isDuplicating, setIsDuplicating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const croppable = isCroppableImage(item.mimeType);

  async function handleSaveAlt(event: React.FormEvent) {
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
      setAltOpen(false);
      toastEdited("Der Alt-Text wurde gespeichert.");
      router.refresh();
    } catch {
      setError("Server nicht erreichbar. Bitte später erneut versuchen.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete() {
    await fetch(`/api/media/${item.id}`, { method: "DELETE" });
    toastDeleted(`„${item.filename}“ wurde gelöscht.`);
    router.refresh();
  }

  async function handleDuplicate() {
    setIsDuplicating(true);
    try {
      await fetch(`/api/media/${item.id}/duplicate`, { method: "POST" });
      toastCreated(`„${item.filename}“ wurde dupliziert.`);
      router.refresh();
    } finally {
      setIsDuplicating(false);
    }
  }

  return (
    <div className="flex justify-end">
      {/* `flex-wrap` statt einer einzelnen, nicht umbrechenden Zeile: das
          übergeordnete `<figure>` hat `overflow-hidden` (für die
          abgerundeten Bildecken) – ohne Umbruch wurden bei schmalen
          Kacheln (viele Icons, wenig Platz) die ersten Buttons einfach
          unsichtbar abgeschnitten statt sichtbar zu bleiben. Mit
          `flex-wrap` rutschen überzählige Icons stattdessen in eine
          zweite Zeile, die Kachel wächst dafür einfach etwas in der
          Höhe – nie mehr verschwindende Icons. Zusätzlich `max-w-[132px]`:
          ohne feste Breite würden bei breiten Kacheln bis zu 5-6 Icons in
          eine Zeile passen – die Breite ist hier bewusst auf knapp 4
          Icon-Buttons (je `size-7` + `gap-1`) gedeckelt, damit maximal 4
          pro Zeile stehen, unabhängig von der Kachelbreite. */}
      <div className="hidden max-w-[132px] flex-wrap items-center justify-end gap-1 md:flex">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={`Alt-Text von ${item.filename} bearbeiten`}
          onClick={() => setAltOpen(true)}
        >
          <Pencil />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={`${item.filename} verschieben`}
          onClick={() => setMoveOpen(true)}
        >
          <FolderInput />
        </Button>
        {croppable && (
          <>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={`${item.filename} zuschneiden`}
              onClick={() => setCropOpen(true)}
            >
              <Crop />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={`Fokuspunkt für ${item.filename} setzen`}
              onClick={() => setFocalOpen(true)}
            >
              <Target />
            </Button>
          </>
        )}
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={`Tags für ${item.filename} bearbeiten`}
          onClick={() => setTagsOpen(true)}
        >
          <Tag />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={`${item.filename} duplizieren`}
          disabled={isDuplicating}
          onClick={handleDuplicate}
        >
          <Copy />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={`${item.filename} löschen`}
          onClick={() => setDeleteOpen(true)}
        >
          <Trash2 />
        </Button>
      </div>

      <div className="md:hidden">
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="ghost"
                size="icon-sm"
                className="rounded-full"
                aria-label={`Aktionen für ${item.filename}`}
              />
            }
          >
            <MoreVertical />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setAltOpen(true)}>
              <Pencil />
              Alt-Text bearbeiten
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setMoveOpen(true)}>
              <FolderInput />
              Verschieben
            </DropdownMenuItem>
            {croppable && (
              <>
                <DropdownMenuItem onClick={() => setCropOpen(true)}>
                  <Crop />
                  Zuschneiden
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setFocalOpen(true)}>
                  <Target />
                  Fokuspunkt setzen
                </DropdownMenuItem>
              </>
            )}
            <DropdownMenuItem onClick={() => setTagsOpen(true)}>
              <Tag />
              Tags bearbeiten
            </DropdownMenuItem>
            <DropdownMenuItem disabled={isDuplicating} onClick={handleDuplicate}>
              <Copy />
              Duplizieren
            </DropdownMenuItem>
            <DropdownMenuItem
              variant="destructive"
              onClick={() => setDeleteOpen(true)}
            >
              <Trash2 />
              Löschen
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <Dialog open={altOpen} onOpenChange={setAltOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Alt-Text bearbeiten</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSaveAlt} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor={`alt-${item.id}`}>Alt-Text</Label>
              <Input
                id={`alt-${item.id}`}
                value={alt}
                onChange={(e) => setAlt(e.target.value)}
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <DialogFooter>
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

      <ConfirmDeleteDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={`„${item.filename}“ löschen?`}
        description="Diese Aktion kann nicht rückgängig gemacht werden."
        onConfirm={handleDelete}
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

      <MediaTagsDialog
        item={item}
        availableTags={availableTags}
        open={tagsOpen}
        onOpenChange={setTagsOpen}
      />
    </div>
  );
}
