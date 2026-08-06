"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { mediaUrl } from "@/lib/media";
import type { MediaListResponse } from "@/lib/api-server";

export function LogoUploadField({
  field,
  label,
  currentUrl,
  folderId,
}: {
  field: "logoExpandedUrl" | "logoCollapsedUrl";
  label: string;
  currentUrl: string | null;
  folderId: string | null;
}) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
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

  async function handleUpload() {
    if (!file) return;
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

      setFile(null);
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
      <div className="flex items-center gap-3">
        <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border bg-muted/40">
          {currentUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={mediaUrl({ url: currentUrl })}
              alt={label}
              className="size-full object-contain"
            />
          ) : (
            <span className="text-xs text-muted-foreground">Kein Bild</span>
          )}
        </div>
        <div className="flex flex-1 items-center gap-2">
          <Input
            type="file"
            accept="image/jpeg,image/png,image/webp,image/svg+xml"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="flex-1"
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!file || isUploading}
            onClick={handleUpload}
          >
            <Upload />
            {isUploading ? "Lädt hoch…" : "Hochladen"}
          </Button>
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
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
