"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import ReactCrop, { type PixelCrop } from "react-image-crop";
import "react-image-crop/dist/ReactCrop.css";

import { toastCreated } from "@/components/app-toast";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { MediaItem } from "@/lib/api-server";
import { mediaUrl } from "@/lib/media";

export function MediaCropDialog({
  item,
  open,
  onOpenChange,
}: {
  item: MediaItem;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const imgRef = useRef<HTMLImageElement>(null);
  const [crop, setCrop] = useState<PixelCrop>();
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  async function handleSave() {
    const img = imgRef.current;
    if (!img || !crop || crop.width < 1 || crop.height < 1) {
      setError("Bitte einen Ausschnitt aufziehen.");
      return;
    }

    // react-image-crop liefert Koordinaten relativ zur angezeigten
    // (evtl. skalierten) Bildgröße – auf die tatsächliche Bilddatei
    // hochrechnen, bevor sie an die API geht.
    const scaleX = img.naturalWidth / img.width;
    const scaleY = img.naturalHeight / img.height;

    setError(null);
    setIsSaving(true);
    try {
      const res = await fetch(`/api/media/${item.id}/crop`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          x: Math.round(crop.x * scaleX),
          y: Math.round(crop.y * scaleY),
          width: Math.round(crop.width * scaleX),
          height: Math.round(crop.height * scaleY),
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setError(body?.message ?? "Zuschnitt fehlgeschlagen.");
        return;
      }

      onOpenChange(false);
      setCrop(undefined);
      toastCreated("Der Zuschnitt wurde als neues Medium gespeichert.");
      router.refresh();
    } catch {
      setError("Server nicht erreichbar. Bitte später erneut versuchen.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>„{item.filename}“ zuschneiden</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Der Zuschnitt wird als neues, eigenständiges Medium gespeichert – das
          Original bleibt unverändert und überall dort erhalten, wo es bereits
          verwendet wird.
        </p>
        <div className="flex max-h-[65vh] justify-center overflow-auto rounded-lg border bg-muted/30 p-2">
          <ReactCrop crop={crop} onChange={(c) => setCrop(c)}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              ref={imgRef}
              src={mediaUrl(item)}
              alt={item.alt ?? item.filename}
              className="max-h-[60vh]"
            />
          </ReactCrop>
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            className="border-border"
            onClick={() => onOpenChange(false)}
          >
            Abbrechen
          </Button>
          <Button type="button" onClick={handleSave} disabled={isSaving}>
            {isSaving ? "Schneidet zu…" : "Zuschneiden & speichern"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
