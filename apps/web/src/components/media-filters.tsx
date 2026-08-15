"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { tagDotColor } from "@/lib/tag-colors";
import { cn } from "@/lib/utils";
import type { MediaCounts, TaxonomyItem } from "@/lib/api-server";

// "document" ist ein reines Filter-Pseudo-Typ (fasst PDF + Office
// zusammen, siehe apps/api/src/media/dto/query-media.dto.ts) – nur echte,
// hochladbare Kategorien als Pillen (Nutzerentscheidung, 2026-08-15):
// kein separates "Audio"/"Archive" ohne Upload-Unterstützung, auch wenn
// die Bildvorlage die zeigt.
const TYPE_OPTIONS: { value: string; label: string; countKey: keyof MediaCounts }[] = [
  { value: "image", label: "Bilder", countKey: "image" },
  { value: "video", label: "Video", countKey: "video" },
  { value: "document", label: "Dokumente", countKey: "document" },
];

// Filter (Dateityp/Tags/ungenutzt) sind vollständig URL-getrieben – analog
// zum bestehenden `?folder=`. So bleiben sie teilbar/verlinkbar und
// funktionieren mit Server-seitigem Pagination-Rendering zusammen.
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
  const selectedTagIds = (searchParams.get("tags") ?? "").split(",").filter(Boolean);
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
            ? "border-transparent bg-[#132033] text-white"
            : "border-[#D4D4D4] bg-transparent hover:bg-muted/40",
        )}
      >
        {label}
        <span
          className={cn(
            "flex min-w-5 items-center justify-center rounded-full px-1.5 text-xs",
            active ? "bg-white/20 text-white" : "bg-muted text-muted-foreground",
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
        <button
          type="button"
          onClick={() => updateParams({ unused: unused ? null : "true" })}
          className={cn(
            "shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors",
            unused
              ? "border-transparent bg-primary text-primary-foreground"
              : "border-[#D4D4D4] bg-transparent hover:bg-muted/40",
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
                ? "border-transparent bg-[#132033] text-white"
                : "border-[#D4D4D4] bg-transparent hover:bg-muted/40",
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
                    ? "border-transparent bg-[#132033] text-white"
                    : "border-[#D4D4D4] bg-transparent hover:bg-muted/40",
                )}
              >
                <span className={cn("size-2 shrink-0 rounded-full", tagDotColor(tag.id))} />
                {tag.name}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
