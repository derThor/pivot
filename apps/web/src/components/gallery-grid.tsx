"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronRight,
  Image as ImageIcon,
  MoreVertical,
  Plus,
  Trash2,
} from "lucide-react";

import { toastDeleted } from "@/components/app-toast";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ConfirmDeleteDialog } from "@/components/confirm-delete-dialog";
import { toRepeaterItems, toImageValue } from "@/components/block-field-output";
import {
  toGallerySettings,
  GALLERY_EFFECT_LABELS,
} from "@/lib/gallery-settings";
import { resolveImageSrc } from "@/lib/media";
import { cn, truncateMiddle } from "@/lib/utils";
import type { GlobalModule, ModuleType } from "@/lib/api-server";
import { bff } from "@/lib/bff";

const darkTextClassName = "text-pivot-navy";
// Höchstens 3 Bild-Kacheln pro Galerie-Karte (Nutzervorgabe, 2026-08-15) –
// die letzte sichtbare Kachel bekommt die "X Bilder"-Badge mit der
// tatsächlichen Gesamtzahl, auch wenn davon nur 3 (oder weniger) angezeigt
// werden.
const MAX_PREVIEW_TILES = 3;

/** Ersetzt die generische Tabellen-Ansicht (`GlobalModulesManager`) für
 * Galerien durch ein Karten-Grid (Nutzervorgabe, 2026-08-15, 1:1 nach
 * Bildvorlage): max. 4 Karten pro Zeile, responsiv bis 1 Spalte auf
 * Mobil, je Karte ein bis zu 3-teiliger Bild-Streifen mit
 * Gesamtanzahl-Badge auf der letzten Kachel. */
export function GalleryGrid({
  items,
  moduleType,
}: {
  items: GlobalModule[];
  moduleType: ModuleType;
}) {
  const router = useRouter();
  const repeaterField = moduleType.schema.fields.find(
    (f) => f.type === "repeater",
  );
  const imageFieldName =
    repeaterField?.fields?.find((f) => f.type === "image")?.name ?? "image";

  const [deleteGallery, setDeleteGallery] = useState<GlobalModule | null>(null);

  function openEditor(gallery: GlobalModule) {
    router.push(`/dashboard/content/galleries/${gallery.id}`);
  }

  async function handleDelete() {
    if (!deleteGallery) return;
    await fetch(bff(`/api/global-modules/${deleteGallery.id}`), {
      method: "DELETE",
    });
    toastDeleted(`„${deleteGallery.name}“ wurde gelöscht.`);
    router.refresh();
  }

  if (!repeaterField) {
    return (
      <p className="text-sm text-muted-foreground">
        Galerie-Modul-Typ hat kein gültiges Bild-Feld.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Noch keine Bildergalerien angelegt.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {items.map((gallery) => {
            const allImages = toRepeaterItems(
              gallery.values[repeaterField.name],
            );
            const visibleImages = allImages.slice(0, MAX_PREVIEW_TILES);
            const effect = toGallerySettings(gallery.settings).effect;

            return (
              <div
                key={gallery.id}
                className="overflow-hidden rounded-2xl bg-card shadow-sm ring-1 ring-border"
              >
                <div className="relative flex h-24 w-full gap-1 bg-secondary">
                  {visibleImages.length === 0 ? (
                    <button
                      type="button"
                      onClick={() => openEditor(gallery)}
                      className="flex size-full flex-col items-center justify-center gap-1 text-[12.5px] font-medium text-pivot-g-body transition hover:text-pivot-navy"
                    >
                      <Plus className="size-5" />
                      Bilder hinzufügen
                    </button>
                  ) : (
                    visibleImages.map((item, index) => {
                      const img = toImageValue(item.values[imageFieldName]);
                      const isLast = index === visibleImages.length - 1;
                      return (
                        <div key={item.id} className="relative h-full flex-1">
                          {img.url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={resolveImageSrc(img.url)}
                              alt=""
                              className="size-full object-cover"
                            />
                          ) : (
                            <div className="flex size-full items-center justify-center bg-secondary">
                              <ImageIcon className="size-5 text-muted-foreground" />
                            </div>
                          )}
                          {isLast && (
                            <span
                              className="absolute top-2 right-2 rounded-md px-2 py-0.5 text-[11px] font-medium text-white"
                              style={{ background: "rgba(19, 32, 51, 0.82)" }}
                            >
                              {allImages.length}{" "}
                              {allImages.length === 1 ? "Bild" : "Bilder"}
                            </span>
                          )}
                        </div>
                      );
                    })
                  )}
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      render={
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          className="absolute top-2 left-2 rounded-full bg-black/50 text-white hover:bg-black/70 hover:text-white"
                          aria-label={`Aktionen für ${gallery.name}`}
                        />
                      }
                    >
                      <MoreVertical />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start">
                      <DropdownMenuItem
                        variant="destructive"
                        onClick={() => setDeleteGallery(gallery)}
                      >
                        <Trash2 />
                        Löschen
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                <button
                  type="button"
                  onClick={() => openEditor(gallery)}
                  className="flex w-full items-center gap-2 px-4 py-3 text-left"
                >
                  <span className="min-w-0 flex-1">
                    <span
                      className={cn(
                        "block text-[15px] font-semibold",
                        darkTextClassName,
                      )}
                    >
                      {gallery.name}
                    </span>
                    <span className="mt-0.5 block text-[12.5px] text-muted-foreground">
                      Effekt: {GALLERY_EFFECT_LABELS[effect]}
                    </span>
                  </span>
                  <ChevronRight
                    className="size-[17px] shrink-0 text-muted-foreground"
                    strokeWidth={1.7}
                  />
                </button>
              </div>
            );
          })}
        </div>
      )}

      <ConfirmDeleteDialog
        open={deleteGallery !== null}
        onOpenChange={(open) => !open && setDeleteGallery(null)}
        title={`„${truncateMiddle(deleteGallery?.name ?? "")}“ löschen?`}
        description="Wird aus allen Seiten entfernt, die sie einbinden, und in den Papierkorb verschoben, von wo sie wiederhergestellt werden kann."
        onConfirm={handleDelete}
      />
    </div>
  );
}
