"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";

import { Input } from "@/components/ui/input";
import {
  searchResultHref,
  searchTypeMeta,
  type SearchResult,
} from "@/lib/search";

const MIN_QUERY_LENGTH = 3;

export function GlobalSearch({
  defaultPageSize,
}: {
  defaultPageSize: number;
}) {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<SearchResult[] | null>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < MIN_QUERY_LENGTH) {
      // Kein Reset von `results` nötig: das Dropdown ist über `open`
      // ausgeblendet, ein veralteter Wert bleibt also unsichtbar.
      setOpen(false);
      return;
    }
    setIsLoading(true);
    setOpen(true);
    const timeout = setTimeout(async () => {
      const res = await fetch(
        `/api/search?q=${encodeURIComponent(trimmed)}&limit=5`,
      );
      const data = await res.json().catch(() => null);
      setResults(Array.isArray(data) ? data : []);
      setIsLoading(false);
    }, 300);
    return () => clearTimeout(timeout);
  }, [query]);

  async function goTo(result: SearchResult) {
    const searchTerm = query.trim();
    setOpen(false);
    setQuery("");
    router.push(await searchResultHref(result, searchTerm, defaultPageSize));
  }

  return (
    <div ref={containerRef} className="relative max-w-sm flex-1">
      <Search className="pointer-events-none absolute top-1/2 left-3 z-10 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        placeholder="Suchen…"
        className="rounded-full bg-muted/60 pl-9"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") setOpen(false);
        }}
      />
      {open && (
        <div className="absolute top-full left-0 z-50 mt-2 w-full min-w-80 overflow-hidden rounded-2xl border bg-popover py-2 text-popover-foreground shadow-lg">
          {isLoading ? (
            <div className="px-4 py-3 text-sm text-muted-foreground">
              Suche…
            </div>
          ) : results && results.length > 0 ? (
            <ul className="divide-y">
              {results.map((result) => {
                const meta = searchTypeMeta[result.type];
                const Icon = meta.icon;
                return (
                  <li key={`${result.type}-${result.id}`}>
                    <button
                      type="button"
                      onClick={() => goTo(result)}
                      className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm hover:bg-muted/60"
                    >
                      <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                        <Icon className="size-3.5" />
                      </span>
                      <span className="min-w-0 flex-1 truncate font-medium">
                        {result.title}
                      </span>
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${meta.badgeClassName}`}
                      >
                        {meta.label}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="px-4 py-3 text-sm text-muted-foreground">
              Keine Treffer.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
