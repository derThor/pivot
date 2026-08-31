"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ImageIcon, Trash2 } from "lucide-react";

import { toastDeleted, toastEdited } from "@/components/app-toast";
import { Button } from "@/components/ui/button";
import { mediaUrl } from "@/lib/media";
import { cn } from "@/lib/utils";
import type { MediaListResponse } from "@/lib/api-server";

export function LogoUploadField({
  field,
  label,
  currentUrl,
  folderId,
  previewClassName,
}: {
  field:
    | "companyLogoUrl"
    | "companyLogoUrlDark"
    | "faviconUrl"
    | "defaultOgImageUrl";
  label: string;
  currentUrl: string | null;
  folderId: string | null;
  // Dark-Mode-Logos sind oft hell/weiß gezeichnet – auf der (immer
  // hellen) Vorschau-Fläche sonst kaum zu erkennen.
  previewClassName?: string;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);

  async function patchSettings(value: string | null) {
    const res = await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [field]: value }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      throw new Error(body?.message ?? "Konnte nicht gespeichert werden.");
    }
  }

  /** Findet den Medien-Eintrag im Logo-Ordner, der aktuell unter dieser URL hinterlegt ist. */
  async function findMediaIdByUrl(url: string): Promise<string | null> {
    if (!folderId) return null;
    const res = await fetch(`/api/media?folderId=${folderId}&pageSize=100`);
    if (!res.ok) return null;
    const data = (await res
      .json()
      .catch(() => null)) as MediaListResponse | null;
    return data?.items.find((item) => item.url === url)?.id ?? null;
  }

  async function deleteMediaByUrl(url: string) {
    const mediaId = await findMediaIdByUrl(url);
    if (mediaId) {
      await fetch(`/api/media/${mediaId}`, { method: "DELETE" });
    }
  }

  async function handleUpload(file: File) {
    setError(null);
    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.set("file", file);
      if (folderId) formData.set("folderId", folderId);

      const uploadRes = await fetch("/api/media", {
        method: "POST",
        body: formData,
      });
      const uploaded = await uploadRes.json().catch(() => null);
      if (!uploadRes.ok) {
        setError(uploaded?.message ?? "Upload fehlgeschlagen.");
        return;
      }

      await patchSettings(uploaded.url);

      // Altes Logo (falls vorhanden) aufräumen, damit sich im Logo-Ordner
      // nicht bei jedem Austausch verwaiste Dateien ansammeln.
      if (currentUrl && currentUrl !== uploaded.url) {
        await deleteMediaByUrl(currentUrl);
      }

      toastEdited(`${label} wurde aktualisiert.`);
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Server nicht erreichbar. Bitte später erneut versuchen.",
      );
    } finally {
      setIsUploading(false);
    }
  }

  async function handleRemove() {
    if (!currentUrl) return;
    setError(null);
    setIsRemoving(true);
    try {
      await patchSettings(null);
      await deleteMediaByUrl(currentUrl);
      toastDeleted(`${label} wurde entfernt.`);
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Server nicht erreichbar. Bitte später erneut versuchen.",
      );
    } finally {
      setIsRemoving(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <span
          className={cn(
            "flex h-8 w-full flex-1 items-center justify-start overflow-hidden rounded-md border bg-background px-2",
            previewClassName,
          )}
        >
          {currentUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={mediaUrl({ url: currentUrl })}
              alt={label}
              className="h-full w-auto object-contain"
            />
          ) : (
            <ImageIcon className="size-4 text-muted-foreground" />
          )}
        </span>
        <label className="has-disabled:pointer-events-none has-disabled:opacity-50">
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,image/svg+xml"
            className="hidden"
            disabled={isUploading}
            onChange={(e) => {
              const nextFile = e.target.files?.[0];
              e.target.value = "";
              if (nextFile) void handleUpload(nextFile);
            }}
          />
          <span className="inline-flex h-8 cursor-pointer items-center rounded-md border border-border bg-background px-3 text-sm font-medium transition-colors hover:bg-muted">
            {isUploading
              ? "Lädt hoch…"
              : currentUrl
                ? "Ersetzen"
                : "Hinzufügen"}
          </span>
        </label>
        {currentUrl && (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={`${label} löschen`}
            disabled={isRemoving}
            onClick={handleRemove}
          >
            <Trash2 />
          </Button>
        )}
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
