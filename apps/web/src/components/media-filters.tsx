"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MEDIA_CATEGORY_LABELS, type MediaCategory } from "@/lib/media-type";
import { cn } from "@/lib/utils";
import type { TaxonomyItem } from "@/lib/api-server";

const CATEGORY_OPTIONS = Object.entries(MEDIA_CATEGORY_LABELS) as [
  MediaCategory,
  string,
][];

// Filter (Dateityp/Größe/Tags) sind vollständig URL-getrieben – analog
// zum bestehenden `?folder=`. So bleiben sie teilbar/verlinkbar und
// funktionieren mit Server-seitigem Pagination-Rendering zusammen.
export function MediaFilters({ tags }: { tags: TaxonomyItem[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const type = searchParams.get("type") ?? "";
  const minSize = searchParams.get("minSize") ?? "";
  const maxSize = searchParams.get("maxSize") ?? "";
  const selectedTagIds = (searchParams.get("tags") ?? "").split(",").filter(Boolean);
  const unused = searchParams.get("unused") === "true";
  const hasActiveFilters = Boolean(type || minSize || maxSize || selectedTagIds.length);

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
    <div className="flex flex-col gap-3 rounded-lg border p-3">
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm">
          <Checkbox
            checked={unused}
            onCheckedChange={(checked) =>
              updateParams({ unused: checked ? "true" : null })
            }
          />
          Nur ungenutzte Medien anzeigen
        </label>
      </div>
      {!unused && (
        <>
          <div className="flex flex-wrap items-center gap-3">
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
              <SelectTrigger size="sm" className="w-44">
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
            <div className="flex items-center gap-1.5">
              <Input
                type="number"
                min={0}
                placeholder="Min. KB"
                className="h-8 w-24"
                defaultValue={minSize ? String(Math.round(Number(minSize) / 1024)) : ""}
                onBlur={(e) =>
                  updateParams({
                    minSize: e.target.value ? String(Number(e.target.value) * 1024) : null,
                  })
                }
              />
              <span className="text-sm text-muted-foreground">–</span>
              <Input
                type="number"
                min={0}
                placeholder="Max. KB"
                className="h-8 w-24"
                defaultValue={maxSize ? String(Math.round(Number(maxSize) / 1024)) : ""}
                onBlur={(e) =>
                  updateParams({
                    maxSize: e.target.value ? String(Number(e.target.value) * 1024) : null,
                  })
                }
              />
            </div>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={() =>
                  updateParams({ type: null, minSize: null, maxSize: null, tags: null })
                }
                className="text-sm text-muted-foreground hover:text-foreground"
              >
                Filter zurücksetzen
              </button>
            )}
          </div>
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {tags.map((tag) => (
                <Badge
                  key={tag.id}
                  variant={selectedTagIds.includes(tag.id) ? "default" : "outline"}
                  className={cn("cursor-pointer select-none")}
                  onClick={() => toggleTag(tag.id)}
                >
                  {tag.name}
                </Badge>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
