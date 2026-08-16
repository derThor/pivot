"use client";

import { useState } from "react";
import { Link2, Upload } from "lucide-react";

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
import { ACCEPTED_VIDEO_MIME_TYPES } from "@/lib/media-type";
import type { MediaFolder, MediaItem } from "@/lib/api-server";

function isVideo(item: MediaItem) {
  return item.mimeType.startsWith("video/");
}

// Analog zu `ImagePickerDialog`, aber auf Videos gefiltert – für den
// Video-Baustein (siehe block-field-output.tsx, module-field-input.tsx).
export function VideoPickerDialog({
  open,
  onOpenChange,
  onSelect,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (url: string, item?: MediaItem) => void;
}) {
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [folders, setFolders] = useState<MediaFolder[]>([]);

  const [file, setFile] = useState<File | null>(null);
  const [uploadFolderId, setUploadFolderId] = useState("root");
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const [linkUrl, setLinkUrl] = useState("");
  const [linkError, setLinkError] = useState<string | null>(null);

  function handleLinkSubmit(event: React.FormEvent) {
    event.preventDefault();
    event.stopPropagation();
    const trimmed = linkUrl.trim();
    if (!trimmed) {
      setLinkError("Bitte einen Link angeben.");
      return;
    }
    setLinkError(null);
    setLinkUrl("");
    onOpenChange(false);
    onSelect(trimmed);
  }

  function resetUploadForm() {
    setFile(null);
    setUploadFolderId(currentFolderId ?? "root");
    setUploadError(null);
  }

  async function handleUpload(event: React.FormEvent) {
    event.preventDefault();
    // Der Dialog wird per Portal gerendert, liegt aber innerhalb des
    // äußeren Content-Formulars – ohne stopPropagation() würde dieser
    // Submit zusätzlich das äußere Formular auslösen (siehe
    // image-picker-dialog.tsx für dasselbe Muster).
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
      if (uploadFolderId !== "root") formData.set("folderId", uploadFolderId);

      const res = await fetch("/api/media", { method: "POST", body: formData });
      const body = await res.json().catch(() => null);

      if (!res.ok) {
        setUploadError(body?.message ?? "Upload fehlgeschlagen.");
        return;
      }

      resetUploadForm();
      onOpenChange(false);
      onSelect(body.url, body as MediaItem);
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
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Video einfügen</DialogTitle>
        </DialogHeader>
        <Tabs defaultValue="library">
          <TabsList>
            <TabsTrigger value="library">Aus Medienbibliothek</TabsTrigger>
            <TabsTrigger value="upload">Neu hochladen</TabsTrigger>
            <TabsTrigger value="link">Per Link</TabsTrigger>
          </TabsList>

          <TabsContent value="library" className="flex flex-col gap-2">
            <MediaBrowserPanel
              open={open}
              accept={isVideo}
              emptyLabel="Keine Videos in diesem Ordner."
              currentFolderId={currentFolderId}
              onFolderChange={setCurrentFolderId}
              onFoldersLoaded={setFolders}
              onSelect={(item) => {
                onOpenChange(false);
                onSelect(item.url, item);
              }}
            />
          </TabsContent>

          <TabsContent value="upload">
            <form onSubmit={handleUpload} className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="video-picker-file">Datei</Label>
                <Input
                  id="video-picker-file"
                  type="file"
                  accept={ACCEPTED_VIDEO_MIME_TYPES}
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="video-picker-folder">Ordner</Label>
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
                  <SelectTrigger id="video-picker-folder" className="w-full">
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
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="border-[#D4D4D4]"
                  onClick={() => onOpenChange(false)}
                >
                  Abbrechen
                </Button>
                <Button type="submit" disabled={isUploading}>
                  <Upload />
                  {isUploading ? "Lädt hoch…" : "Hochladen & einfügen"}
                </Button>
              </div>
            </form>
          </TabsContent>

          <TabsContent value="link">
            <form onSubmit={handleLinkSubmit} className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="video-picker-link">Video-Link</Label>
                <Input
                  id="video-picker-link"
                  type="url"
                  placeholder="https://youtube.com/watch?v=… oder direkter Video-Link"
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  YouTube- und Vimeo-Links werden automatisch eingebettet.
                  Andere Links (z.B. direkte .mp4-Datei) werden direkt
                  abgespielt.
                </p>
              </div>
              {linkError && (
                <p className="text-sm text-destructive">{linkError}</p>
              )}
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="border-[#D4D4D4]"
                  onClick={() => onOpenChange(false)}
                >
                  Abbrechen
                </Button>
                <Button type="submit">
                  <Link2 />
                  Einfügen
                </Button>
              </div>
            </form>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
