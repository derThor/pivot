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
import { ACCEPTED_MEDIA_MIME_TYPES } from "@/lib/media-type";
import type { MediaFolder, MediaItem } from "@/lib/api-server";

// Analog zu `ImagePickerDialog`, aber ohne Typfilter – zum Einfügen eines
// Links auf ein beliebiges Medium (PDF/Video/Office/…) im Rich-Text.
export function FilePickerDialog({
  open,
  onOpenChange,
  onSelect,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (item: MediaItem) => void;
}) {
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [folders, setFolders] = useState<MediaFolder[]>([]);

  const [file, setFile] = useState<File | null>(null);
  const [uploadFolderId, setUploadFolderId] = useState("root");
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  function resetUploadForm() {
    setFile(null);
    setUploadFolderId(currentFolderId ?? "root");
    setUploadError(null);
  }

  async function handleUpload(event: React.FormEvent) {
    event.preventDefault();
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
      onSelect(body as MediaItem);
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
          <DialogTitle>Datei einfügen</DialogTitle>
        </DialogHeader>
        <Tabs defaultValue="library">
          <TabsList>
            <TabsTrigger value="library">Aus Medienbibliothek</TabsTrigger>
            <TabsTrigger value="upload">Neu hochladen</TabsTrigger>
          </TabsList>

          <TabsContent value="library" className="flex flex-col gap-2">
            <MediaBrowserPanel
              open={open}
              emptyLabel="Keine Dateien in diesem Ordner."
              currentFolderId={currentFolderId}
              onFolderChange={setCurrentFolderId}
              onFoldersLoaded={setFolders}
              onSelect={(item) => {
                onOpenChange(false);
                onSelect(item);
              }}
            />
          </TabsContent>

          <TabsContent value="upload">
            <form onSubmit={handleUpload} className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="file-picker-file">Datei</Label>
                <Input
                  id="file-picker-file"
                  type="file"
                  accept={ACCEPTED_MEDIA_MIME_TYPES}
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="file-picker-folder">Ordner</Label>
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
                  <SelectTrigger id="file-picker-folder" className="w-full">
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
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
