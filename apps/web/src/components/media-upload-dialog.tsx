"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Upload } from "lucide-react";

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getIndentedFolderOptions } from "@/lib/media-folders";
import { ACCEPTED_MEDIA_MIME_TYPES } from "@/lib/media-type";
import type { MediaFolder } from "@/lib/api-server";

export function MediaUploadDialog({
  folders = [],
  defaultFolderId = null,
}: {
  folders?: MediaFolder[];
  defaultFolderId?: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [alt, setAlt] = useState("");
  const [folderId, setFolderId] = useState(defaultFolderId ?? "root");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const folderOptions = getIndentedFolderOptions(folders);

  function reset() {
    setFile(null);
    setAlt("");
    setFolderId(defaultFolderId ?? "root");
    setError(null);
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!file) {
      setError("Bitte eine Datei auswählen.");
      return;
    }

    setError(null);
    setIsSubmitting(true);
    try {
      const formData = new FormData();
      formData.set("file", file);
      if (alt) formData.set("alt", alt);
      if (folderId !== "root") formData.set("folderId", folderId);

      const res = await fetch("/api/media", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setError(body?.message ?? "Upload fehlgeschlagen.");
        return;
      }

      setOpen(false);
      reset();
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
        if (!next) reset();
      }}
    >
      <DialogTrigger render={<Button />}>
        <Upload />
        Datei hochladen
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Medium hochladen</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="media-file">Datei</Label>
            <Input
              id="media-file"
              type="file"
              accept={ACCEPTED_MEDIA_MIME_TYPES}
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="media-alt">Alt-Text (optional)</Label>
            <Input
              id="media-alt"
              value={alt}
              onChange={(e) => setAlt(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="media-folder">Ordner</Label>
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
              <SelectTrigger id="media-folder" className="w-full">
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
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Lädt hoch…" : "Hochladen"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
