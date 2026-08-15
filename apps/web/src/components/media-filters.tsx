"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { tagDotColor } from "@/lib/tag-colors";
import { MEDIA_CATEGORY_LABELS, type MediaCategory } from "@/lib/media-type";
import { cn } from "@/lib/utils";
import type { TaxonomyItem } from "@/lib/api-server";

const CATEGORY_OPTIONS = Object.entries(MEDIA_CATEGORY_LABELS) as [
  MediaCategory,
  string,
][];

// Filter (Dateityp/Tags/ungenutzt) sind vollständig URL-getrieben – analog
// zum bestehenden `?folder=`. So bleiben sie teilbar/verlinkbar und
// funktionieren mit Server-seitigem Pagination-Rendering zusammen.
export function MediaFilters({ tags }: { tags: TaxonomyItem[] }) {
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

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Select
          value={type || "all"}
          onValueChange={(value) =>
            updateParams({ type: value === "all" ? null : value })
          }
          items={{
            all: "Alle Dateitypen",
            ...Object.fromEntries(CATEGORY_OPTIONS),
          }}
        >
          <SelectTrigger className="h-11 rounded-lg border-[#D4D4D4] px-4">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle Dateitypen</SelectItem>
            {CATEGORY_OPTIONS.map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <button
          type="button"
          onClick={() => updateParams({ unused: unused ? null : "true" })}
          className={cn(
            "h-11 shrink-0 rounded-lg border px-4 text-sm font-medium transition-colors",
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
