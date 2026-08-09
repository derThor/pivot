"use client";

import { useState } from "react";
import { Upload } from "lucide-react";

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
import { MediaBrowserPanel } from "@/components/media-browser-panel";
import { getIndentedFolderOptions } from "@/lib/media-folders";
import { ACCEPTED_IMAGE_MIME_TYPES } from "@/lib/media-type";
import type { MediaFolder, MediaItem } from "@/lib/api-server";

function isImage(item: MediaItem) {
  return item.mimeType.startsWith("image/");
}

export function ImagePickerDialog({
  open,
  onOpenChange,
  onSelect,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // `item` liefert u.a. die beim Upload generierten Responsive-Varianten
  // mit (siehe `MediaItem.variants`) – Aufrufer, die daraus ein
  // `<picture>`-`srcSet` bauen wollen (Seiten-Designer), nutzen den
  // dritten Parameter; einfachere Aufrufer (Rich-Text) ignorieren ihn.
  onSelect: (url: string, alt?: string, item?: MediaItem) => void;
}) {
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [folders, setFolders] = useState<MediaFolder[]>([]);

  const [file, setFile] = useState<File | null>(null);
  const [alt, setAlt] = useState("");
  const [uploadFolderId, setUploadFolderId] = useState("root");
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

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
      onSelect(body.url, body.alt ?? undefined, body as MediaItem);
    } catch {
      setUploadError("Server nicht erreichbar. Bitte später erneut versuchen.");
    } finally {
      setIsUploading(false);
    }
  }

  const folderOptions = getIndentedFolderOptions(folders);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (next) setCurrentFolderId(null);
        else resetUploadForm();
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
            <MediaBrowserPanel
              open={open}
              accept={isImage}
              emptyLabel="Keine Bilder in diesem Ordner."
              currentFolderId={currentFolderId}
              onFolderChange={setCurrentFolderId}
              onFoldersLoaded={setFolders}
              onSelect={(item) => {
                onOpenChange(false);
                onSelect(item.url, item.alt ?? undefined, item);
              }}
            />
          </TabsContent>

          <TabsContent value="upload">
            <form onSubmit={handleUpload} className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="image-picker-file">Datei</Label>
                <Input
                  id="image-picker-file"
                  type="file"
                  accept={ACCEPTED_IMAGE_MIME_TYPES}
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
