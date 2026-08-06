"use client";

import { useEffect, useState } from "react";
import { ChevronRight, Folder, FolderTree, Home, Image, Upload } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { mediaUrl } from "@/lib/media";
import {
  getFolderBreadcrumb,
  getFolderChildren,
  getIndentedFolderOptions,
} from "@/lib/media-folders";
import type { MediaFolder, MediaItem, MediaListResponse } from "@/lib/api-server";

export function ImagePickerDialog({
  open,
  onOpenChange,
  onSelect,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (url: string, alt?: string) => void;
}) {
  const [items, setItems] = useState<MediaItem[] | null>(null);
  const [folders, setFolders] = useState<MediaFolder[]>([]);
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [file, setFile] = useState<File | null>(null);
  const [alt, setAlt] = useState("");
  const [uploadFolderId, setUploadFolderId] = useState("root");
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setItems(null);
    setCurrentFolderId(null);
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
        setItems(
          mediaData.items.filter((item) => item.mimeType.startsWith("image/")),
        );
        setFolders(folderData ?? []);
      })
      .catch(() => setLoadError("Server nicht erreichbar."));
  }, [open]);

  useEffect(() => {
    setUploadFolderId(currentFolderId ?? "root");
  }, [currentFolderId]);

  function resetUploadForm() {
    setFile(null);
    setAlt("");
    setUploadFolderId(currentFolderId ?? "root");
    setUploadError(null);
  }

  async function handleUpload(event: React.FormEvent) {
    event.preventDefault();
    // Der Dialog wird per Portal gerendert, liegt aber (Content-Editor
    // → RichTextEditor → ImagePickerDialog) innerhalb des äußeren
    // Content-Formulars. React lässt Submit-Events trotz Portal über
    // den React-Baum bubbeln – ohne stopPropagation() würde dieser
    // Submit zusätzlich das äußere Formular auslösen und den ganzen
    // Content-Eintrag speichern.
    event.stopPropagation();
    if (!file) {
      setUploadError("Bitte eine Datei auswählen.");
      return;
    }

    setUploadError(null);
    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.set("file", file);
      if (alt) formData.set("alt", alt);
      if (uploadFolderId !== "root") formData.set("folderId", uploadFolderId);

      const res = await fetch("/api/media", { method: "POST", body: formData });
      const body = await res.json().catch(() => null);

      if (!res.ok) {
        setUploadError(body?.message ?? "Upload fehlgeschlagen.");
        return;
      }

      resetUploadForm();
      onOpenChange(false);
      onSelect(body.url, body.alt ?? undefined);
    } catch {
      setUploadError("Server nicht erreichbar. Bitte später erneut versuchen.");
    } finally {
      setIsUploading(false);
    }
  }

  const breadcrumb = getFolderBreadcrumb(folders, currentFolderId);
  const childFolders = getFolderChildren(folders, currentFolderId);
  const visibleItems = items?.filter(
    (item) => item.folderId === currentFolderId,
  );
  const folderOptions = getIndentedFolderOptions(folders);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) resetUploadForm();
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Bild einfügen</DialogTitle>
        </DialogHeader>
        <Tabs defaultValue="library">
          <TabsList>
            <TabsTrigger value="library">Aus Medienbibliothek</TabsTrigger>
            <TabsTrigger value="upload">Neu hochladen</TabsTrigger>
          </TabsList>

          <TabsContent value="library" className="flex flex-col gap-2">
            {loadError && (
              <p className="text-sm text-destructive">{loadError}</p>
            )}
            {!loadError && items === null && (
              <p className="text-sm text-muted-foreground">Lädt…</p>
            )}
            {items && (
              <>
                <nav className="flex flex-wrap items-center gap-1 text-xs">
                  <button
                    type="button"
                    onClick={() => setCurrentFolderId(null)}
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
                        onClick={() => setCurrentFolderId(folder.id)}
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
                  <div className="flex flex-wrap gap-2">
                    {childFolders.map((folder) => (
                      <button
                        key={folder.id}
                        type="button"
                        onClick={() => setCurrentFolderId(folder.id)}
                        className="flex flex-col gap-1 rounded-md border border-input px-2 py-1 text-xs hover:border-ring"
                      >
                        <span className="flex items-center gap-1.5">
                          <Folder className="size-3.5 text-muted-foreground" />
                          {folder.name}
                        </span>
                        <span className="flex items-center gap-1">
                          <Badge variant="secondary">
                            <Image />
                            {folder.mediaCount}
                          </Badge>
                          {folder.childCount > 0 && (
                            <Badge variant="secondary">
                              <FolderTree />
                              {folder.childCount}
                            </Badge>
                          )}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
                {visibleItems?.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    Keine Bilder in diesem Ordner.
                  </p>
                )}
                {visibleItems && visibleItems.length > 0 && (
                  <div className="grid max-h-80 grid-cols-4 gap-2 overflow-y-auto">
                    {visibleItems.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        className="aspect-square overflow-hidden rounded-md border border-input transition-colors hover:border-ring"
                        onClick={() => {
                          onOpenChange(false);
                          onSelect(item.url, item.alt ?? undefined);
                        }}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={mediaUrl(item)}
                          alt={item.alt ?? item.filename}
                          className="h-full w-full object-cover"
                        />
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </TabsContent>

          <TabsContent value="upload">
            <form onSubmit={handleUpload} className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="image-picker-file">Datei</Label>
                <Input
                  id="image-picker-file"
                  type="file"
                  accept="image/jpeg,image/png,image/gif,image/webp,image/svg+xml"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="image-picker-alt">Alt-Text (optional)</Label>
                <Input
                  id="image-picker-alt"
                  value={alt}
                  onChange={(e) => setAlt(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="image-picker-folder">Ordner</Label>
                <Select
                  value={uploadFolderId}
                  onValueChange={(value) => setUploadFolderId(value ?? "root")}
                  items={{
                    root: "Kein Ordner (Root)",
                    ...Object.fromEntries(
                      folderOptions.map((option) => [option.id, option.label]),
                    ),
                  }}
                >
                  <SelectTrigger id="image-picker-folder" className="w-full">
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
              </div>
              {uploadError && (
                <p className="text-sm text-destructive">{uploadError}</p>
              )}
              <Button type="submit" disabled={isUploading}>
                <Upload />
                {isUploading ? "Lädt hoch…" : "Hochladen & einfügen"}
              </Button>
            </form>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
