"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, X } from "lucide-react";

import { Input } from "@/components/ui/input";
import {
  searchResultHref,
  searchTypeMeta,
  type SearchResult,
} from "@/lib/search";

const MIN_QUERY_LENGTH = 3;

/** Echtes, direkt eintippbares Suchfeld im Header (Nutzervorgabe,
 * 2026-08-16: "ich kann die suche nicht mehr anklicken" – ersetzt den
 * vorherigen reinen Button, der komplett die Befehlspalette öffnete). Der
 * "Strg K"-Badge rechts im Feld ist ein eigener Klick-Ziel-Bereich, der
 * über `onOpenPalette` ausschließlich die Befehlspalette öffnet – der Rest
 * des Feldes ist normale Live-Suche mit Dropdown-Vorschau, wie vorher in
 * der jetzt entfernten `global-search.tsx`, nur ohne deren Hover-Ausfahr-
 * Animation (im neuen Header-Design immer voll sichtbar). */
export function HeaderSearch({
  defaultPageSize,
  onOpenPalette,
}: {
  defaultPageSize: number;
  onOpenPalette: () => void;
}) {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
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

  function clear() {
    setQuery("");
    setResults(null);
    setOpen(false);
    inputRef.current?.blur();
  }

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < MIN_QUERY_LENGTH) {
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
    <div ref={containerRef} className="relative h-11 w-full min-w-0 shrink sm:w-72">
      <div className="flex h-11 w-full items-center gap-2 rounded-full border bg-card px-4">
        <Search className="size-4 shrink-0 text-muted-foreground" />
        <Input
          ref={inputRef}
          placeholder="Suchen ..."
          className="h-auto flex-1 border-none bg-transparent p-0 text-sm shadow-none focus-visible:ring-0"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              clear();
              return;
            }
            if (e.key === "Enter") {
              const trimmed = query.trim();
              if (trimmed.length < MIN_QUERY_LENGTH) return;
              e.preventDefault();
              setOpen(false);
              router.push(`/dashboard/search?q=${encodeURIComponent(trimmed)}`);
            }
          }}
        />
        {query.length > 0 ? (
          <button
            type="button"
            aria-label="Suche zurücksetzen"
            onClick={clear}
            className="shrink-0 text-muted-foreground hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        ) : (
          <button
            type="button"
            onClick={onOpenPalette}
            className="hidden shrink-0 rounded-md bg-muted px-2 py-1 font-sans text-xs text-muted-foreground hover:text-foreground sm:inline-block"
          >
            Strg K
          </button>
        )}
      </div>
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
