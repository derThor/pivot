"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, X } from "lucide-react";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  searchResultHref,
  searchTypeMeta,
  type SearchResult,
} from "@/lib/search";

const MIN_QUERY_LENGTH = 3;

export function GlobalSearch({ defaultPageSize }: { defaultPageSize: number }) {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<SearchResult[] | null>(null);
  const [isHovered, setIsHovered] = useState(false);
  const [isFocused, setIsFocused] = useState(false);

  // Ausgefahren bei Hover/Fokus/Eingabe – kollabiert sonst wieder zum
  // reinen Icon (siehe Referenz-Screenshot: Icon wie die Glocke, kein
  // dauerhaft sichtbares Eingabefeld).
  const expanded = isHovered || isFocused || query.length > 0 || open;

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
        setIsHovered(false);
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
    setIsHovered(false);
  }

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
    <div
      ref={containerRef}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="relative h-12 w-12 shrink-0"
    >
      <div
        className={cn(
          "absolute top-0 right-0 flex h-12 items-center transition-[width] duration-200 ease-out",
          expanded ? "w-96" : "w-12",
        )}
      >
        <button
          type="button"
          aria-label={query.length > 0 ? "Suche zurücksetzen" : "Suchen"}
          tabIndex={-1}
          onClick={() =>
            query.length > 0 ? clear() : inputRef.current?.focus()
          }
          className="absolute top-0 right-0 z-10 flex size-12 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:text-foreground"
        >
          {query.length > 0 ? (
            <X className="size-4" />
          ) : (
            <Search className="pointer-events-none size-4" />
          )}
        </button>
        <Input
          ref={inputRef}
          placeholder="Suchen…"
          className={cn(
            "h-12 w-full rounded-full border-none bg-card pr-12 shadow-sm transition-[padding-left,opacity] duration-200 ease-out",
            expanded ? "pl-4 opacity-100" : "pl-0 opacity-0",
          )}
          value={query}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              clear();
              return;
            }
            // Enter -> vollständige Detailsuche-Seite statt der nur auf
            // wenige Treffer je Bereich begrenzten Dropdown-Vorschau.
            if (e.key === "Enter") {
              const trimmed = query.trim();
              if (trimmed.length < MIN_QUERY_LENGTH) return;
              e.preventDefault();
              setOpen(false);
              router.push(`/dashboard/search?q=${encodeURIComponent(trimmed)}`);
            }
          }}
        />
      </div>
      {open && (
        <div className="absolute top-full right-0 z-50 mt-2 w-96 overflow-hidden rounded-2xl border bg-popover py-2 text-popover-foreground shadow-lg">
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
