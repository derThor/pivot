"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ImageIcon, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { mediaUrl } from "@/lib/media";
import type { MediaListResponse } from "@/lib/api-server";

export function LogoUploadField({
  field,
  label,
  currentUrl,
  folderId,
}: {
  field: "companyLogoUrl";
  label: string;
  currentUrl: string | null;
  folderId: string | null;
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
    const res = await fetch(
      `/api/media?folderId=${folderId}&pageSize=100`,
    );
    if (!res.ok) return null;
    const data = (await res.json().catch(() => null)) as MediaListResponse | null;
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
      <Label>{label}</Label>
      <div className="flex flex-wrap items-center gap-3">
        <label className="group/upload relative block size-32 shrink-0 cursor-pointer overflow-hidden rounded-md border border-dashed text-left transition-colors hover:border-orange-400 has-disabled:pointer-events-none has-disabled:opacity-50">
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
          {currentUrl ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={mediaUrl({ url: currentUrl })}
                alt={label}
                className="size-full object-contain"
              />
              <div className="absolute inset-0 flex items-center justify-center bg-black/50 text-sm font-medium text-white opacity-0 transition-opacity group-hover/upload:opacity-100">
                {isUploading ? "Lädt hoch…" : "Ersetzen"}
              </div>
            </>
          ) : (
            <div className="flex size-full flex-col items-center justify-center gap-1 text-sm text-muted-foreground">
              <ImageIcon className="size-5" />
              {isUploading ? "Lädt hoch…" : "Bild hinzufügen"}
            </div>
          )}
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
