import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type PageItem = number | "ellipsis";

function getPageItems(page: number, pageCount: number): PageItem[] {
  const pages = new Set<number>([1, pageCount]);
  for (let i = page - 1; i <= page + 1; i++) {
    if (i >= 1 && i <= pageCount) pages.add(i);
  }

  const sorted = [...pages].sort((a, b) => a - b);
  const items: PageItem[] = [];
  let previous = 0;
  for (const p of sorted) {
    if (previous && p - previous > 1) items.push("ellipsis");
    items.push(p);
    previous = p;
  }
  return items;
}

// Zwei Modi: `buildHref` für echte, URL-getriebene Seiten (Standardfall,
// server-gerenderte Listen) oder `onPageChange` für lokal (clientseitig)
// paginierte Listen innerhalb einer Seite (z.B. "Aktive Sitzungen" im
// Benutzer-Bearbeiten-Tab, wo eine eigene URL-Seite nicht passt).
type PaginationControlsProps = {
  page: number;
  pageCount: number;
} & (
  | { buildHref: (page: number) => string; onPageChange?: never }
  | { onPageChange: (page: number) => void; buildHref?: never }
);

export function PaginationControls({
  page,
  pageCount,
  buildHref,
  onPageChange,
}: PaginationControlsProps) {
  if (pageCount <= 1) return null;

  const items = getPageItems(page, pageCount);

  return (
    <div className="relative mb-6 flex items-center justify-center">
      <div className="flex items-center gap-1.5">
        {items.map((item, index) =>
          item === "ellipsis" ? (
            <span
              key={`ellipsis-${index}`}
              className="flex size-7 items-center justify-center text-sm text-muted-foreground"
            >
              …
            </span>
          ) : (
            <Button
              key={item}
              type="button"
              variant={item === page ? "default" : "ghost"}
              size="icon-sm"
              className={cn(
                "rounded-full",
                item === page && "disabled:opacity-100",
              )}
              disabled={item === page}
              aria-current={item === page ? "page" : undefined}
              // `onClick` nur bauen, wenn `onPageChange` (Client-Modus)
              // wirklich übergeben wurde: eine Closure hier unbedingt zu
              // erzeugen, auch wenn sie im `buildHref`-Modus nie feuert,
              // reicht schon aus, damit Next.js beim serverseitigen Rendern
              // ("Event handlers cannot be passed to Client Component
              // props") abbricht, sobald diese Seite (server-gerendert)
              // aufgerufen wird.
              onClick={
                onPageChange && item !== page
                  ? () => onPageChange(item)
                  : undefined
              }
              render={
                item === page ? undefined : buildHref ? (
                  <Link href={buildHref(item)} />
                ) : undefined
              }
            >
              {item}
            </Button>
          ),
        )}
      </div>

      <div className="absolute right-0 flex items-center overflow-hidden rounded-full border border-input bg-card shadow-card">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="rounded-none bg-card"
          aria-label="Vorherige Seite"
          disabled={page <= 1}
          onClick={
            onPageChange && page > 1 ? () => onPageChange(page - 1) : undefined
          }
          render={
            page > 1 && buildHref ? (
              <Link href={buildHref(page - 1)} />
            ) : undefined
          }
        >
          <ChevronLeft />
        </Button>
        <div className="h-4 w-px bg-border" />
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="rounded-none bg-card"
          aria-label="Nächste Seite"
          disabled={page >= pageCount}
          onClick={
            onPageChange && page < pageCount
              ? () => onPageChange(page + 1)
              : undefined
          }
          render={
            page < pageCount && buildHref ? (
              <Link href={buildHref(page + 1)} />
            ) : undefined
          }
        >
          <ChevronRight />
        </Button>
      </div>
    </div>
  );
}
