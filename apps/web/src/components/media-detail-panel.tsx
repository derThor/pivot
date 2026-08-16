"use client";

import { createElement, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Copy,
  Download,
  Link as LinkIcon,
  MoreVertical,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";

import { toastCreated, toastDeleted, toastEdited } from "@/components/app-toast";
import { focalObjectPosition } from "@/components/block-field-output";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ConfirmDeleteDialog } from "@/components/confirm-delete-dialog";
import { MediaEditDialog } from "@/components/media-edit-dialog";
import { MediaTagsDialog } from "@/components/media-tags-dialog";
import { mediaUrl } from "@/lib/media";
import {
  isSvg,
  mediaCategory,
  mediaTypeIcon,
  mediaTypeLabel,
  mediaTypeStyle,
} from "@/lib/media-type";
import { tagDotColor } from "@/lib/tag-colors";
import { cn, formatBytes } from "@/lib/utils";
import type { MediaFolder, MediaItem, TaxonomyItem } from "@/lib/api-server";

const dateFormatter = new Intl.DateTimeFormat("de-DE", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-2 border-b border-[#F0F0F0] pb-2 text-sm">
      <span className="shrink-0 whitespace-nowrap text-muted-foreground">
        {label}
      </span>
      <span className="line-clamp-2 text-right font-medium">{value}</span>
    </div>
  );
}

/** Rechte Seitenleiste der Medien-Übersicht (Nutzervorgabe, 2026-08-17,
 * 1:1 nach Bildvorlage) – ersetzt das bisherige Vorschau-Popup
 * (`media-preview-dialog.tsx`): Klick auf eine Kachel zeigt die Details
 * hier an, statt ein Modal zu öffnen. "Verwendet" wird lazy nachgeladen
 * (eigener Endpoint `GET /media/:id/usage`, scannt alle Inhalte – zu
 * teuer, um es für jedes Element der Liste im Voraus zu berechnen). */
export function MediaDetailPanel({
  item,
  folders,
  availableTags,
  onClose,
}: {
  item: MediaItem;
  folders: MediaFolder[];
  availableTags: TaxonomyItem[];
  onClose: () => void;
}) {
  const router = useRouter();
  const showAsImage = mediaCategory(item.mimeType) === "image" && !isSvg(item.mimeType);
  const [usageCount, setUsageCount] = useState<number | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [tagsOpen, setTagsOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [isDuplicating, setIsDuplicating] = useState(false);

  useEffect(() => {
    setUsageCount(null);
    fetch(`/api/media/${item.id}/usage`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setUsageCount(typeof data?.count === "number" ? data.count : 0))
      .catch(() => setUsageCount(0));
  }, [item.id]);

  async function handleCopyLink() {
    await navigator.clipboard.writeText(mediaUrl(item));
    toastEdited("Der Link wurde in die Zwischenablage kopiert.");
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

  async function handleDelete() {
    await fetch(`/api/media/${item.id}`, { method: "DELETE" });
    toastDeleted(`„${item.filename}“ wurde gelöscht.`);
    onClose();
    router.refresh();
  }

  return (
    <div className="flex w-full min-w-0 flex-col gap-4 rounded-[10px] bg-card p-4 shadow-sm">
      <div className="relative">
        {showAsImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={mediaUrl(item)}
            alt={item.alt ?? item.filename}
            style={{
              objectPosition: focalObjectPosition({
                focalX: item.focalX ?? undefined,
                focalY: item.focalY ?? undefined,
              }),
            }}
            className="max-h-[165px] w-full rounded-xl border object-cover"
          />
        ) : (
          <div
            className={cn(
              "flex h-[165px] w-full flex-col items-center justify-center gap-2 rounded-xl",
              mediaTypeStyle(item.mimeType).bg,
            )}
          >
            {createElement(mediaTypeIcon(item.mimeType), {
              className: cn("size-10", mediaTypeStyle(item.mimeType).fg),
            })}
            <span className={cn("text-xs font-medium", mediaTypeStyle(item.mimeType).fg)}>
              {mediaTypeLabel(item.mimeType)}
            </span>
          </div>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="absolute top-2 right-2 rounded-full bg-white/90 shadow-sm hover:bg-white"
                aria-label={`Weitere Aktionen für ${item.filename}`}
              />
            }
          >
            <MoreVertical />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
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

      <p className="truncate text-sm font-semibold">{item.filename}</p>

      <div className="flex flex-col gap-2 border-t pt-3">
        <InfoRow label="Format" value={item.mimeType.split("/")[1]?.toUpperCase() ?? item.mimeType} />
        {item.width && item.height && (
          <InfoRow label="Maße" value={`${item.width}×${item.height}`} />
        )}
        <InfoRow label="Größe" value={formatBytes(item.size)} />
        <InfoRow label="Hochgeladen" value={dateFormatter.format(new Date(item.createdAt))} />
        <InfoRow label="Alt-Text" value={item.alt || "—"} />
        <InfoRow
          label="Verwendet"
          value={
            usageCount === null
              ? "…"
              : `${usageCount} ${usageCount === 1 ? "Seite" : "Seiten"}`
          }
        />
      </div>

      <div className="flex flex-col gap-2 border-t pt-3">
        <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          Tags
        </p>
        <div className="flex flex-wrap items-center gap-1.5">
          {item.tags.map((tag) => (
            <span
              key={tag.id}
              className="flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium"
            >
              <span className={cn("size-1.5 shrink-0 rounded-full", tagDotColor(tag.id))} />
              {tag.name}
            </span>
          ))}
          <button
            type="button"
            onClick={() => setTagsOpen(true)}
            className="flex items-center gap-1 rounded-full border border-dashed px-2.5 py-1 text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            <Plus className="size-3" />
            Tag
          </button>
        </div>
      </div>

      <a
        href={mediaUrl(item)}
        download
        className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-primary text-sm font-semibold text-primary-foreground hover:opacity-90"
      >
        <Download className="size-4" />
        Herunterladen
      </a>

      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          className="min-w-0 flex-1 px-2"
          onClick={() => setEditOpen(true)}
        >
          <Pencil className="shrink-0" />
          <span className="truncate">Bearbeiten</span>
        </Button>
        <Button
          type="button"
          variant="outline"
          className="min-w-0 flex-1 px-2"
          onClick={handleCopyLink}
        >
          <LinkIcon className="shrink-0" />
          <span className="truncate">Link kopieren</span>
        </Button>
      </div>

      <MediaEditDialog
        item={item}
        folders={folders}
        open={editOpen}
        onOpenChange={setEditOpen}
      />
      <MediaTagsDialog
        item={item}
        availableTags={availableTags}
        open={tagsOpen}
        onOpenChange={setTagsOpen}
      />
      <ConfirmDeleteDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={`„${item.filename}“ löschen?`}
        description="Diese Aktion kann nicht rückgängig gemacht werden."
        onConfirm={handleDelete}
      />
    </div>
  );
}
