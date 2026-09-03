"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { SortMenu } from "@/components/sort-menu";

import { tagDotColor } from "@/lib/tag-colors";
import { cn } from "@/lib/utils";
import type { MediaCounts, TaxonomyItem } from "@/lib/api-server";

// "document" ist ein reines Filter-Pseudo-Typ (fasst PDF + Office
// zusammen, siehe apps/api/src/media/dto/query-media.dto.ts) – nur echte,
// hochladbare Kategorien als Pillen (Nutzerentscheidung, 2026-08-15):
// kein separates "Audio"/"Archive" ohne Upload-Unterstützung, auch wenn
// die Bildvorlage die zeigt.
const TYPE_OPTIONS: {
  value: string;
  label: string;
  countKey: keyof MediaCounts;
}[] = [
  { value: "image", label: "Bilder", countKey: "image" },
  { value: "video", label: "Video", countKey: "video" },
  { value: "document", label: "Dokumente", countKey: "document" },
];

// Filter (Dateityp/Tags/ungenutzt) sind vollständig URL-getrieben – analog
// zum bestehenden `?folder=`. So bleiben sie teilbar/verlinkbar und
// funktionieren mit Server-seitigem Pagination-Rendering zusammen.
/** Sortier-Vorgaben der Mediathek. Feste Paare aus Feld und Richtung,
 * damit die Beschriftung sagt, was passiert ("Groesste zuerst" statt
 * "Groesse absteigend"). */
const MEDIA_SORT_OPTIONS = [
  { field: "createdAt", dir: "desc" as const, label: "Neueste zuerst" },
  { field: "createdAt", dir: "asc" as const, label: "Aelteste zuerst" },
  { field: "filename", dir: "asc" as const, label: "Name A-Z" },
  { field: "filename", dir: "desc" as const, label: "Name Z-A" },
  { field: "size", dir: "desc" as const, label: "Groesste zuerst" },
  { field: "size", dir: "asc" as const, label: "Kleinste zuerst" },
  { field: "mimeType", dir: "asc" as const, label: "Dateityp" },
];

export function MediaFilters({
  tags,
  counts,
}: {
  tags: TaxonomyItem[];
  counts: MediaCounts | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const type = searchParams.get("type") ?? "";
  const selectedTagIds = (searchParams.get("tags") ?? "")
    .split(",")
    .filter(Boolean);
  const unused = searchParams.get("unused") === "true";

  function updateParams(updates: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(updates)) {
      if (value) params.set(key, value);
      else params.delete(key);
    }
    params.delete("page");
    router.push(`${pathname}?${params.toString()}`);
  }

  function toggleTag(tagId: string) {
    const next = selectedTagIds.includes(tagId)
      ? selectedTagIds.filter((id) => id !== tagId)
      : [...selectedTagIds, tagId];
    updateParams({ tags: next.length ? next.join(",") : null });
  }

  function typePill(value: string | null, label: string, count: number) {
    const active = value === null ? type === "" : type === value;
    return (
      <button
        key={value ?? "all"}
        type="button"
        onClick={() => updateParams({ type: value })}
        className={cn(
          "flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors",
          active
            ? "border-transparent bg-dark-surface text-dark-surface-foreground"
            : "border-button-border bg-card hover:bg-muted/40",
        )}
      >
        {label}
        <span
          className={cn(
            "flex min-w-5 items-center justify-center rounded-full px-1.5 text-xs",
            active
              ? "bg-white/20 text-white"
              : "bg-muted text-muted-foreground",
          )}
        >
          {count}
        </span>
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="mr-1 shrink-0 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          Dateityp
        </span>
        {typePill(null, "Alle", counts?.total ?? 0)}
        {TYPE_OPTIONS.map((option) =>
          typePill(option.value, option.label, counts?.[option.countKey] ?? 0),
        )}
        {/* Sortierung in derselben Zeile wie die Filter (Nutzervorgabe,
            2026-09-03) – beides sind Einstellungen an derselben Liste und
            gehören nebeneinander, nicht in zwei Zeilen übereinander.
            `ml-auto` schiebt es ans Ende der Zeile, damit die Filter-Pillen
            links zusammenbleiben. */}
        <div className="ml-auto">
          {/* Gleiche Form und Höhe wie "Nur ungenutzte" daneben
              (Nutzervorgabe, 2026-09-03) – in einer Reihe mit den
              Filter-Pillen wäre eine abweichende Schaltfläche ein Bruch. */}
          <SortMenu
            options={MEDIA_SORT_OPTIONS}
            className="h-auto shrink-0 rounded-full border-button-border px-3.5 py-1.5 text-sm font-medium"
          />
        </div>
        <button
          type="button"
          onClick={() => updateParams({ unused: unused ? null : "true" })}
          className={cn(
            "shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors",
            unused
              ? "border-transparent bg-primary text-primary-foreground"
              : "border-button-border bg-card hover:bg-muted/40",
          )}
        >
          Nur ungenutzte
        </button>
      </div>

      {!unused && tags.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="mr-1 shrink-0 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            Nach Tag filtern
          </span>
          <button
            type="button"
            onClick={() => updateParams({ tags: null })}
            className={cn(
              "rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors",
              selectedTagIds.length === 0
                ? "border-transparent bg-dark-surface text-dark-surface-foreground"
                : "border-button-border bg-card hover:bg-muted/40",
            )}
          >
            Alle
          </button>
          {tags.map((tag) => {
            const active = selectedTagIds.includes(tag.id);
            return (
              <button
                key={tag.id}
                type="button"
                onClick={() => toggleTag(tag.id)}
                className={cn(
                  "flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors",
                  active
                    ? "border-transparent bg-dark-surface text-dark-surface-foreground"
                    : "border-button-border bg-card hover:bg-muted/40",
                )}
              >
                <span
                  className={cn(
                    "size-2 shrink-0 rounded-full",
                    tagDotColor(tag.id),
                  )}
                />
                {tag.name}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
