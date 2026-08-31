"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import ReactCrop, {
  centerCrop,
  makeAspectCrop,
  cropToCanvas,
  type PixelCrop,
} from "react-image-crop";
import "react-image-crop/dist/ReactCrop.css";

import { toastEdited } from "@/components/app-toast";
import { Button } from "@/components/ui/button";
import { bff } from "@/lib/bff";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// Anders als media-crop-dialog.tsx (schneidet ein bereits hochgeladenes
// Medium serverseitig zu einem NEUEN, eigenständigen Medium zu) läuft der
// Zuschnitt hier komplett clientseitig auf der noch nicht hochgeladenen
// Datei – für ein Profilfoto will man ein Ergebnis, kein zusätzliches,
// unbeschnittenes Medium in der Bibliothek. Quadratisches Seitenverhältnis
// fest vorgegeben (`aspect={1}`), passend zum runden Avatar-Ausschnitt.
export function AvatarCropDialog({
  file,
  open,
  onOpenChange,
}: {
  file: File | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const imgRef = useRef<HTMLImageElement>(null);
  const [crop, setCrop] = useState<PixelCrop>();
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!file) {
      setObjectUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setObjectUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  function handleImageLoad(event: React.SyntheticEvent<HTMLImageElement>) {
    const { width, height } = event.currentTarget;
    setCrop(
      centerCrop(
        makeAspectCrop({ unit: "px", width: width * 0.9 }, 1, width, height),
        width,
        height,
      ),
    );
  }

  async function handleSave() {
    const img = imgRef.current;
    if (!img || !crop || crop.width < 1 || crop.height < 1) {
      setError("Bitte einen Ausschnitt auswählen.");
      return;
    }

    setError(null);
    setIsSaving(true);
    try {
      const canvas = document.createElement("canvas");
      await cropToCanvas(img, canvas, crop);
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/png"),
      );
      if (!blob) {
        setError("Zuschnitt konnte nicht erzeugt werden.");
        return;
      }

      const formData = new FormData();
      formData.set("file", blob, file?.name ?? "avatar.png");
      const res = await fetch(bff("/api/auth/me/avatar"), {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setError(body?.message ?? "Foto konnte nicht hochgeladen werden.");
        return;
      }

      onOpenChange(false);
      setCrop(undefined);
      toastEdited("Profilfoto wurde aktualisiert.");
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
          <DialogTitle>Profilfoto zuschneiden</DialogTitle>
        </DialogHeader>
        {objectUrl && (
          <div className="flex max-h-[60vh] justify-center overflow-auto rounded-lg border bg-muted/30 p-2">
            <ReactCrop
              crop={crop}
              onChange={(c) => setCrop(c)}
              aspect={1}
              circularCrop
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                ref={imgRef}
                src={objectUrl}
                alt="Zuschnitt-Vorschau"
                className="max-h-[55vh]"
                onLoad={handleImageLoad}
              />
            </ReactCrop>
          </div>
        )}
        {error && <p className="text-sm text-destructive">{error}</p>}
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            className="border-button-border"
            onClick={() => onOpenChange(false)}
          >
            Abbrechen
          </Button>
          <Button type="button" onClick={handleSave} disabled={isSaving}>
            {isSaving ? "Speichert…" : "Zuschneiden & speichern"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
