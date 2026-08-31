"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { toastEdited } from "@/components/app-toast";
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
import { cn } from "@/lib/utils";
import { bff } from "@/lib/bff";

export function MediaFocalPointDialog({
  item,
  open,
  onOpenChange,
}: {
  item: MediaItem;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [focal, setFocal] = useState({
    x: item.focalX ?? 0.5,
    y: item.focalY ?? 0.5,
  });
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  function handlePick(e: React.MouseEvent<HTMLImageElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    setFocal({
      x: Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width)),
      y: Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height)),
    });
  }

  async function handleSave() {
    setError(null);
    setIsSaving(true);
    try {
      const res = await fetch(bff(`/api/media/${item.id}`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ focalX: focal.x, focalY: focal.y }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setError(body?.message ?? "Konnte nicht gespeichert werden.");
        return;
      }

      onOpenChange(false);
      toastEdited("Der Fokuspunkt wurde gespeichert.");
      router.refresh();
    } catch {
      setError("Server nicht erreichbar. Bitte später erneut versuchen.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Fokuspunkt für „{item.filename}“</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Auf das Bild klicken, um den Fokuspunkt zu setzen. Er wird als Anker
          für künftig aus diesem Bild erzeugte Zuschnitte/Varianten verwendet.
        </p>
        <div className="relative overflow-hidden rounded-lg border">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={mediaUrl(item)}
            alt={item.alt ?? item.filename}
            onClick={handlePick}
            className="block max-h-[55vh] w-full cursor-crosshair object-contain"
          />
          <div
            className={cn(
              "pointer-events-none absolute size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-orange-500 shadow",
            )}
            style={{ left: `${focal.x * 100}%`, top: `${focal.y * 100}%` }}
          />
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
            {isSaving ? "Speichert…" : "Speichern"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
