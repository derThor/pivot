"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";

import { toastDeleted, toastEdited } from "@/components/app-toast";
import { resolveImageSrc } from "@/lib/media";
import type { MediaListResponse } from "@/lib/api-server";
import { bff } from "@/lib/bff";

/** Logo-Upload auf der Mandant-Detailseite (Nutzervorgabe, 2026-08-27,
 * 1:1 nach Bildvorlage: gestricheltes Quadrat mit "+", statt der
 * horizontalen Leiste von `logo-upload-field.tsx` – eigene, schmale
 * Komponente statt Verallgemeinerung, da beide Stellen bewusst
 * unterschiedlich aussehen sollen). Selbes Upload-Prinzip: Datei über
 * `/api/media` in den Logo-Systemordner hochladen, URL danach am
 * Mandanten speichern. */
export function MandantLogoField({
  mandantId,
  currentUrl,
  folderId,
}: {
  mandantId: string;
  currentUrl: string | null;
  folderId: string | null;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);

  async function patchMandant(logoUrl: string | null) {
    const res = await fetch(bff(`/api/mandanten/${mandantId}`), {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ logoUrl }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      throw new Error(body?.message ?? "Konnte nicht gespeichert werden.");
    }
  }

  async function findMediaIdByUrl(url: string): Promise<string | null> {
    if (!folderId) return null;
    const res = await fetch(
      bff(`/api/media?folderId=${folderId}&pageSize=100`),
    );
    if (!res.ok) return null;
    const data = (await res
      .json()
      .catch(() => null)) as MediaListResponse | null;
    return data?.items.find((item) => item.url === url)?.id ?? null;
  }

  async function deleteMediaByUrl(url: string) {
    const mediaId = await findMediaIdByUrl(url);
    if (mediaId) {
      await fetch(bff(`/api/media/${mediaId}`), { method: "DELETE" });
    }
  }

  async function handleUpload(file: File) {
    setError(null);
    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.set("file", file);
      if (folderId) formData.set("folderId", folderId);

      const uploadRes = await fetch(bff("/api/media"), {
        method: "POST",
        body: formData,
      });
      const uploaded = await uploadRes.json().catch(() => null);
      if (!uploadRes.ok) {
        setError(uploaded?.message ?? "Upload fehlgeschlagen.");
        return;
      }

      await patchMandant(uploaded.url);

      if (currentUrl && currentUrl !== uploaded.url) {
        await deleteMediaByUrl(currentUrl);
      }

      toastEdited("Logo wurde aktualisiert.");
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
      await patchMandant(null);
      await deleteMediaByUrl(currentUrl);
      toastDeleted("Logo wurde entfernt.");
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
    <div className="flex flex-col gap-1.5">
      <div
        className={`group relative h-14 shrink-0 ${currentUrl ? "w-36" : "w-14"}`}
      >
        <label
          className={`flex size-full items-center justify-center overflow-hidden rounded-xl transition-colors ${
            currentUrl
              ? "bg-primary"
              : "cursor-pointer border border-dashed border-white/30 text-white/70 hover:border-white hover:text-white"
          } ${isUploading ? "pointer-events-none opacity-50" : ""}`}
        >
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
            // eslint-disable-next-line @next/next/no-img-element -- Logo kommt aus Nutzer-Upload (beliebige externe/lokale URL), kein next/image-Optimierungsfall.
            <img
              src={resolveImageSrc(currentUrl)}
              alt="Logo"
              className="size-full object-contain px-3 py-1.5"
            />
          ) : (
            <Plus className="size-5" />
          )}
        </label>
        {currentUrl && (
          <button
            type="button"
            aria-label="Logo entfernen"
            disabled={isRemoving}
            onClick={handleRemove}
            className="absolute -top-1.5 -right-1.5 flex size-5 items-center justify-center rounded-full border border-border bg-card text-muted-foreground opacity-0 shadow-sm transition-opacity group-hover:opacity-100 hover:text-destructive disabled:opacity-100"
          >
            <Trash2 className="size-3" />
          </button>
        )}
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
