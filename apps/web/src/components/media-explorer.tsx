"use client";

import { useLayoutEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ChevronRight, Download, Folder, Home } from "lucide-react";

import { FolderTileMenu } from "@/components/folder-tile-menu";
import { MediaDetailPanel } from "@/components/media-detail-panel";
import { useHighlightParam } from "@/hooks/use-highlight-param";
import {
  fileExtensionLabel,
  isSvg,
  mediaCategory,
  mediaTypeIcon,
  mediaTypeStyle,
} from "@/lib/media-type";
import { mediaUrl, resolveImageSrc } from "@/lib/media";
import { getFolderBreadcrumb, getFolderChildren } from "@/lib/media-folders";
import { tagDotColor } from "@/lib/tag-colors";
import { cn } from "@/lib/utils";
import type { MediaFolder, MediaItem, TaxonomyItem } from "@/lib/api-server";

// Spaltenzahl je Grid-Breite – dieselben Stufen wie zuvor die
// Tailwind-`columns-*`-Utilities, jetzt aber in JS ausgewertet (siehe
// `useMasonryColumns` unten), da echtes Masonry (kürzeste Spalte zuerst
// befüllen) die Spaltenzuordnung pro Element kennen muss, nicht nur die
// Anzahl der Spalten.
function columnCountForWidth(width: number): number {
  if (width >= 1536) return 6;
  if (width >= 1280) return 5;
  if (width >= 640) return 4;
  return 3;
}

/** Echtes Masonry (Nutzervorgabe, 2026-08-17: "erzwinge masonry" /
 * "bilder müssen sich automatisch einfügen ... leerräume ... rechts
 * lassen") – CSS-`columns-*` füllt eine Spalte vollständig, bevor die
 * nächste beginnt, wodurch eine kurze Spalte darunter dauerhaft leer
 * bleibt statt spätere Elemente dort einzusortieren. Stattdessen wird
 * hier jedes Element der aktuell **kürzesten** Spalte zugeordnet
 * (Pinterest-Algorithmus), die Höhe wird aus dem bekannten
 * `width`/`height` des Mediums geschätzt (kein Bild-Laden nötig, um die
 * Spaltenzuordnung zu berechnen). Elemente ohne Maße (z.B. PDFs, die als
 * Quadrat gerendert werden) zählen als Seitenverhältnis 1:1.
 */
function useMasonryColumns(items: MediaItem[]) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [columnCount, setColumnCount] = useState(4);

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    // Synchron vor dem ersten Paint korrigieren (statt in einem normalen
    // `useEffect`, der erst danach läuft) – sonst sieht man beim Laden kurz
    // die für SSR/Hydration angenommenen 4 Spalten, bevor auf die tatsächliche
    // Spaltenzahl umgesprungen wird ("Bilder flippen von groß zu klein").
    setColumnCount(columnCountForWidth(el.getBoundingClientRect().width));
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width ?? el.offsetWidth;
      setColumnCount(columnCountForWidth(width));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const columns = useMemo(() => {
    const heights = Array<number>(columnCount).fill(0);
    const cols: MediaItem[][] = Array.from({ length: columnCount }, () => []);
    for (const item of items) {
      const aspectRatio = item.width && item.height ? item.height / item.width : 1;
      let shortest = 0;
      for (let i = 1; i < heights.length; i++) {
        if (heights[i] < heights[shortest]) shortest = i;
      }
      cols[shortest].push(item);
      heights[shortest] += aspectRatio;
    }
    return cols;
  }, [items, columnCount]);

  return { containerRef, columns };
}

// `thumbnailUrl` ist bewusst immer quadratisch zugeschnitten (siehe
// knowledge-base/media/media-square-thumbnails-and-tiles-block.md) – für
// den "Kacheln"-Baustein im Seiten-Designer richtig, für ein Masonry-Grid
// aber genau falsch: jede Kachel bekäme dasselbe Seitenverhältnis, echtes
// Masonry (unterschiedliche Höhen) wäre unmöglich. Deshalb hier stattdessen
// die kleinste verfügbare responsive Variante (natürliches Seitenverhältnis)
// nutzen, Fallback auf das Original.
function gridThumbnailSrc(item: MediaItem) {
  if (item.variants.length === 0) return resolveImageSrc(item.url);
  const smallest = [...item.variants].sort((a, b) => a.width - b.width)[0];
  return resolveImageSrc(smallest.url);
}

function MediaTile({
  item,
  isSelected,
  onClick,
}: {
  item: MediaItem;
  isSelected: boolean;
  onClick: () => void;
}) {
  const showAsImage = mediaCategory(item.mimeType) === "image" && !isSvg(item.mimeType);
  return (
    <button
      id={`media-item-${item.id}`}
      type="button"
      onClick={onClick}
      className={cn(
        "group relative mb-3 block w-full overflow-hidden rounded-2xl bg-card ring-2 ring-offset-2 ring-transparent ring-offset-transparent transition-shadow",
        isSelected && "ring-primary ring-offset-white",
      )}
    >
      {showAsImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={gridThumbnailSrc(item)}
          alt={item.alt ?? item.filename}
          className="block w-full"
        />
      ) : (
        <div
          className={cn(
            "flex aspect-square w-full flex-col items-center justify-center gap-2",
            mediaTypeStyle(item.mimeType).bg,
          )}
        >
          {(() => {
            const Icon = mediaTypeIcon(item.mimeType);
            const { fg } = mediaTypeStyle(item.mimeType);
            return <Icon className={cn("size-8", fg)} />;
          })()}
          <span className={cn("text-xs font-medium", mediaTypeStyle(item.mimeType).fg)}>
            {fileExtensionLabel(item.filename, item.mimeType)}
          </span>
        </div>
      )}
      <span className="absolute top-2 left-2 rounded-md bg-[#132033]/80 px-2 py-0.5 text-[11px] font-medium text-white">
        {fileExtensionLabel(item.filename, item.mimeType)}
      </span>

      {/* Hover-Overlay: Download-Button + Dateiname/Tags (Nutzervorgabe,
          2026-08-17, 1:1 nach Bildvorlage) – nur bei Hover sichtbar, damit
          die Kacheln in Ruhe genauso aufgeräumt bleiben wie ohne Overlay. */}
      <a
        href={mediaUrl(item)}
        download
        onClick={(e) => e.stopPropagation()}
        aria-label={`${item.filename} herunterladen`}
        className="absolute top-2 right-2 flex size-7 items-center justify-center rounded-full bg-white/90 text-[#132033] opacity-0 shadow-sm transition-opacity group-hover:opacity-100 hover:bg-white"
      >
        <Download className="size-3.5" />
      </a>
      <div className="absolute inset-x-0 bottom-0 flex flex-col gap-1.5 bg-gradient-to-t from-[#132033]/90 via-[#132033]/50 to-transparent px-3 pt-8 pb-2.5 text-left opacity-0 transition-opacity group-hover:opacity-100">
        <span className="truncate text-xs font-medium text-white">{item.filename}</span>
        {item.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {item.tags.map((tag) => (
              <span
                key={tag.id}
                className="flex items-center gap-1 rounded-full bg-white/90 px-1.5 py-0.5 text-[10px] font-medium text-[#132033]"
              >
                <span className={cn("size-1.5 shrink-0 rounded-full", tagDotColor(tag.id))} />
                {tag.name}
              </span>
            ))}
          </div>
        )}
      </div>
    </button>
  );
}

/** Ersetzt `media-grid.tsx` + `media-folder-browser.tsx` (Nutzervorgabe,
 * 2026-08-17, 1:1 nach Bildvorlage): echtes Masonry-Grid (siehe
 * `useMasonryColumns` oben) statt fester Grid-Spalten, Klick auf eine
 * Kachel öffnet die Detailansicht in `media-detail-panel.tsx` rechts
 * daneben statt eines Popups. Bewusst **ohne** die bisherige
 * Massenauswahl/Checkbox-Leiste – kommt in der Bildvorlage nicht vor. */
export function MediaExplorer({
  folders,
  currentFolderId,
  items,
  availableTags,
  hideFolders = false,
}: {
  folders: MediaFolder[];
  currentFolderId: string | null;
  items: MediaItem[];
  availableTags: TaxonomyItem[];
  /** Für die ordnerübergreifende "Nur ungenutzte"-Ansicht (Nutzervorgabe,
   * 2026-08-15) – Breadcrumb/Ordner-Kacheln ergeben dort keinen Sinn, da
   * die Liste absichtlich nicht nach Ordner gefiltert ist. */
  hideFolders?: boolean;
}) {
  // Ziel eines globalen Suche-Treffers (`?highlight=<id>`, siehe
  // lib/search.ts#searchResultHref) – öffnet die Detailansicht statt
  // (wie in anderen Listen) nur einen Textabschnitt farblich zu
  // markieren, da die Kacheln hier keinen sichtbaren Dateinamen mehr
  // zeigen. Render-Zeit-Sync statt setState im Effekt, gleiches Muster
  // wie `useHighlightParam` selbst nutzt.
  const { activeId } = useHighlightParam("media-item");
  const [selectedId, setSelectedId] = useState<string | null>(activeId);
  const [syncedActiveId, setSyncedActiveId] = useState(activeId);
  if (activeId !== syncedActiveId) {
    setSyncedActiveId(activeId);
    if (activeId) setSelectedId(activeId);
  }
  const breadcrumb = hideFolders ? [] : getFolderBreadcrumb(folders, currentFolderId);
  const childFolders = hideFolders ? [] : getFolderChildren(folders, currentFolderId);
  const selectedItem = items.find((item) => item.id === selectedId) ?? null;
  const { containerRef, columns } = useMasonryColumns(items);

  return (
    <div className="flex flex-col gap-4">
      {breadcrumb.length > 0 && (
        <nav className="flex flex-wrap items-center gap-1 text-sm">
          <Link
            href="/dashboard/media"
            className="flex items-center gap-1 text-muted-foreground hover:text-foreground"
          >
            <Home className="size-4" />
            Medien
          </Link>
          {breadcrumb.map((folder) => (
            <span key={folder.id} className="flex items-center gap-1">
              <ChevronRight className="size-4 text-muted-foreground" />
              <Link
                href={`/dashboard/media?folder=${folder.id}`}
                className={
                  folder.id === currentFolderId
                    ? "font-medium text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }
                aria-current={folder.id === currentFolderId ? "page" : undefined}
              >
                {folder.name}
              </Link>
            </span>
          ))}
        </nav>
      )}

      {childFolders.length > 0 && (
        <div className="flex flex-wrap gap-3">
          {childFolders.map((folder) => (
            <div
              key={folder.id}
              className="flex w-56 items-center gap-3 rounded-xl border bg-card p-3 shadow-sm"
            >
              <Link
                href={`/dashboard/media?folder=${folder.id}`}
                className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/15"
              >
                <Folder className="size-5 text-primary" fill="currentColor" strokeWidth={1.5} />
              </Link>
              <div className="min-w-0 flex-1">
                <Link
                  href={`/dashboard/media?folder=${folder.id}`}
                  className="block truncate text-sm font-semibold"
                  title={folder.name}
                >
                  {folder.name}
                </Link>
                <p className="text-xs whitespace-nowrap text-muted-foreground">
                  {folder.mediaCount} {folder.mediaCount === 1 ? "Datei" : "Dateien"}
                </p>
              </div>
              <FolderTileMenu folder={folder} />
            </div>
          ))}
        </div>
      )}

      {items.length === 0 ? (
        <div className="flex h-24 items-center justify-center rounded-lg border text-sm text-muted-foreground">
          Noch keine Medien vorhanden.
        </div>
      ) : (
        <div className="flex flex-col gap-4 lg:flex-row">
          <div ref={containerRef} className="flex min-w-0 gap-3 lg:flex-1">
            {columns.map((column, columnIndex) => (
              <div key={columnIndex} className="flex min-w-0 flex-1 flex-col">
                {column.map((item) => (
                  <MediaTile
                    key={item.id}
                    item={item}
                    isSelected={item.id === selectedId}
                    onClick={() =>
                      setSelectedId(item.id === selectedId ? null : item.id)
                    }
                  />
                ))}
              </div>
            ))}
          </div>

          {selectedItem && (
            <div className="lg:w-[380px] lg:shrink-0">
              <div className="lg:sticky lg:top-24">
                <MediaDetailPanel
                  item={selectedItem}
                  folders={folders}
                  availableTags={availableTags}
                  onClose={() => setSelectedId(null)}
                />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
