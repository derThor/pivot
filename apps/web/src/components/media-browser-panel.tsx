"use client";

import { useEffect, useState } from "react";
import { ChevronRight, Folder, FolderTree, Home, Image as ImageIcon } from "lucide-react";

import { mediaUrl, resolveImageSrc } from "@/lib/media";
import { mediaCategory, mediaTypeIcon } from "@/lib/media-type";
import {
  getFolderBreadcrumb,
  getFolderChildren,
} from "@/lib/media-folders";
import type { MediaFolder, MediaItem, MediaListResponse } from "@/lib/api-server";

// Gemeinsame Browsing-Logik (Ordner-Navigation + Grid) für
// `ImagePickerDialog` (nur Bilder) und `FilePickerDialog` (alle
// Dateitypen) – Filterung über `accept`, Auswahl-Verhalten über
// `onSelect` liegt beim Aufrufer.
export function MediaBrowserPanel({
  open,
  accept,
  onSelect,
  emptyLabel = "Keine Dateien in diesem Ordner.",
  currentFolderId,
  onFolderChange,
  onFoldersLoaded,
}: {
  open: boolean;
  accept?: (item: MediaItem) => boolean;
  onSelect: (item: MediaItem) => void;
  emptyLabel?: string;
  currentFolderId: string | null;
  onFolderChange: (folderId: string | null) => void;
  // Erlaubt Aufrufern (z.B. den Ordner-Select im Upload-Tab), dieselbe
  // Ordnerliste mitzunutzen, ohne sie ein zweites Mal zu laden.
  onFoldersLoaded?: (folders: MediaFolder[]) => void;
}) {
  const [items, setItems] = useState<MediaItem[] | null>(null);
  const [folders, setFolders] = useState<MediaFolder[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setItems(null);
    setLoadError(null);
    Promise.all([
      fetch("/api/media?pageSize=100").then((res) =>
        res.ok ? (res.json() as Promise<MediaListResponse>) : null,
      ),
      fetch("/api/media-folders").then((res) =>
        res.ok ? (res.json() as Promise<MediaFolder[]>) : null,
      ),
    ])
      .then(([mediaData, folderData]) => {
        if (!mediaData) {
          setLoadError("Medien konnten nicht geladen werden.");
          return;
        }
        setItems(accept ? mediaData.items.filter(accept) : mediaData.items);
        setFolders(folderData ?? []);
        onFoldersLoaded?.(folderData ?? []);
      })
      .catch(() => setLoadError("Server nicht erreichbar."));
    // `accept` ist eine bei jedem Render neu erstellte Inline-Funktion der
    // Aufrufer – bewusst nicht in die Deps aufgenommen, sonst würde bei
    // jedem Render neu geladen. Nachladen soll nur beim Öffnen passieren.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const breadcrumb = getFolderBreadcrumb(folders, currentFolderId);
  const childFolders = getFolderChildren(folders, currentFolderId);
  const visibleItems = items?.filter((item) => item.folderId === currentFolderId);

  if (loadError) return <p className="text-sm text-destructive">{loadError}</p>;
  if (items === null) return <p className="text-sm text-muted-foreground">Lädt…</p>;

  return (
    <>
      <nav className="flex flex-wrap items-center gap-1 text-xs">
        <button
          type="button"
          onClick={() => onFolderChange(null)}
          className="flex items-center gap-1 text-muted-foreground hover:text-foreground"
        >
          <Home className="size-3.5" />
          Medien
        </button>
        {breadcrumb.map((folder) => (
          <span key={folder.id} className="flex items-center gap-1">
            <ChevronRight className="size-3.5 text-muted-foreground" />
            <button
              type="button"
              onClick={() => onFolderChange(folder.id)}
              className={
                folder.id === currentFolderId
                  ? "font-medium text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }
            >
              {folder.name}
            </button>
          </span>
        ))}
      </nav>
      {childFolders.length > 0 && (
        <div className="flex flex-wrap gap-3">
          {childFolders.map((folder) => (
            <button
              key={folder.id}
              type="button"
              onClick={() => onFolderChange(folder.id)}
              className="flex w-16 flex-col items-center gap-1"
            >
              <span className="relative flex size-14 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 shadow-sm">
                <Folder className="size-7 text-white" fill="currentColor" strokeWidth={1.5} />
                {folder.mediaCount > 0 && (
                  <span className="absolute -bottom-1.5 -left-1.5 flex h-4 min-w-4 items-center justify-center gap-0.5 rounded-full border-2 border-background bg-secondary px-1 text-[9px] font-semibold text-secondary-foreground">
                    <ImageIcon className="size-2.5" />
                    {folder.mediaCount}
                  </span>
                )}
                {folder.childCount > 0 && (
                  <span className="absolute -bottom-1.5 -right-1.5 flex h-4 min-w-4 items-center justify-center gap-0.5 rounded-full border-2 border-background bg-secondary px-1 text-[9px] font-semibold text-secondary-foreground">
                    <FolderTree className="size-2.5" />
                    {folder.childCount}
                  </span>
                )}
              </span>
              <span className="w-full truncate text-center text-xs">{folder.name}</span>
            </button>
          ))}
        </div>
      )}
      {visibleItems?.length === 0 && (
        <p className="text-sm text-muted-foreground">{emptyLabel}</p>
      )}
      {visibleItems && visibleItems.length > 0 && (
        <div className="grid max-h-80 grid-cols-4 gap-2 overflow-y-auto">
          {visibleItems.map((item) => {
            const isImage = mediaCategory(item.mimeType) === "image";
            const Icon = mediaTypeIcon(item.mimeType);
            return (
              <button
                key={item.id}
                type="button"
                className="aspect-square overflow-hidden rounded-md border border-input transition-colors hover:border-ring"
                onClick={() => onSelect(item)}
              >
                {isImage ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={item.thumbnailUrl ? resolveImageSrc(item.thumbnailUrl) : mediaUrl(item)}
                    alt={item.alt ?? item.filename}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span className="flex h-full w-full flex-col items-center justify-center gap-1 bg-muted/50 p-1">
                    <Icon className="size-6 text-muted-foreground" />
                    <span className="w-full truncate text-center text-[10px] text-muted-foreground">
                      {item.filename}
                    </span>
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </>
  );
}
