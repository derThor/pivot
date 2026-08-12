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

export function PaginationControls({
  page,
  pageCount,
  buildHref,
}: {
  page: number;
  pageCount: number;
  buildHref: (page: number) => string;
}) {
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
              variant={item === page ? "default" : "ghost"}
              size="icon-sm"
              className={cn(
                "rounded-full",
                item === page && "disabled:opacity-100",
              )}
              disabled={item === page}
              aria-current={item === page ? "page" : undefined}
              render={
                item === page ? undefined : <Link href={buildHref(item)} />
              }
            >
              {item}
            </Button>
          ),
        )}
      </div>

      <div className="absolute right-0 flex items-center overflow-hidden rounded-full border border-input bg-card shadow-card">
        <Button
          variant="ghost"
          size="icon-sm"
          className="rounded-none bg-card"
          aria-label="Vorherige Seite"
          disabled={page <= 1}
          render={page > 1 ? <Link href={buildHref(page - 1)} /> : undefined}
        >
          <ChevronLeft />
        </Button>
        <div className="h-4 w-px bg-border" />
        <Button
          variant="ghost"
          size="icon-sm"
          className="rounded-none bg-card"
          aria-label="Nächste Seite"
          disabled={page >= pageCount}
          render={
            page < pageCount ? <Link href={buildHref(page + 1)} /> : undefined
          }
        >
          <ChevronRight />
        </Button>
      </div>
    </div>
  );
}
