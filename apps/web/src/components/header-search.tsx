"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, X } from "lucide-react";

import { Input } from "@/components/ui/input";
import { bff } from "@/lib/bff";
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
 * Animation (im neuen Header-Design immer voll sichtbar).
 *
 * Mobil (Nutzervorgabe): das volle Suchfeld nimmt auf schmalen Viewports
 * zu viel Platz im Header weg – dort nur eine Lupe als Icon-Button. Klick
 * ersetzt den kompletten Header-Inhalt (nicht nur diese Komponente) durch
 * das volle Suchfeld ("oben im Header, nicht darunter") – deshalb ist der
 * Auf-/Zu-Klapp-Zustand hier kontrolliert von `dashboard-header.tsx`
 * hochgehoben statt lokaler State, dieselbe Komponente muss auf
 * Header-Ebene wissen, ob sie die restlichen Header-Elemente verdrängt.
 * Schwelle ist der eigene `compact`-Breakpoint (992px, siehe
 * globals.css), nicht Tailwinds `sm` (640px) – Nutzervorgabe. */
export function HeaderSearch({
  defaultPageSize,
  onOpenPalette,
  mobileOpen,
  onMobileOpenChange,
  shortcutsEnabled = true,
}: {
  defaultPageSize: number;
  onOpenPalette: () => void;
  mobileOpen: boolean;
  onMobileOpenChange: (open: boolean) => void;
  /** Steuert nicht nur das Tastenkürzel selbst (siehe `command-palette.tsx`),
   * sondern auch dieses "Strg K"-Badge – bei deaktiviertem Kürzel wäre ein
   * weiterhin sichtbarer, klickbarer Badge irreführend (Nutzervorgabe,
   * 2026-08-21: "nur einblenden und funktional, wenn aktiv"). */
  shortcutsEnabled?: boolean;
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

  useEffect(() => {
    if (mobileOpen) inputRef.current?.focus();
  }, [mobileOpen]);

  function clear() {
    setQuery("");
    setResults(null);
    setOpen(false);
    inputRef.current?.blur();
  }

  function closeMobile() {
    clear();
    onMobileOpenChange(false);
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
        bff(`/api/search?q=${encodeURIComponent(trimmed)}&limit=5`),
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
    onMobileOpenChange(false);
    router.push(await searchResultHref(result, searchTerm, defaultPageSize));
  }

  function handleInputKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") {
      if (mobileOpen) closeMobile();
      else clear();
      return;
    }
    if (e.key === "Enter") {
      const trimmed = query.trim();
      if (trimmed.length < MIN_QUERY_LENGTH) return;
      e.preventDefault();
      setOpen(false);
      onMobileOpenChange(false);
      router.push(`/dashboard/search?q=${encodeURIComponent(trimmed)}`);
    }
  }

  const resultsDropdown = open && (
    <div className="absolute top-full left-0 z-50 mt-2 w-full max-w-full overflow-hidden rounded-2xl border bg-popover py-2 text-popover-foreground shadow-lg">
      {isLoading ? (
        <div className="px-4 py-3 text-sm text-muted-foreground">Suche…</div>
      ) : results && results.length > 0 ? (
        <ul className="max-h-[60vh] divide-y overflow-y-auto">
          {results.map((result) => {
            const meta = searchTypeMeta[result.type];
            const Icon = meta.icon;
            return (
              <li key={`${result.type}-${result.id}`}>
                <button
                  type="button"
                  onClick={() => goTo(result)}
                  className="flex w-full min-w-0 items-center gap-3 px-4 py-2.5 text-left text-sm hover:bg-muted/60"
                >
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                    <Icon className="size-3.5" />
                  </span>
                  <span className="min-w-0 flex-1 truncate font-medium">
                    {result.title}
                  </span>
                  <span
                    className={`shrink-0 rounded-[5px] px-2 py-0.5 text-[11px] font-medium ${meta.badgeClassName}`}
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
  );

  if (mobileOpen) {
    return (
      <div ref={containerRef} className="relative w-full compact:hidden">
        <div className="flex h-11 w-full items-center gap-2 rounded-full border bg-card px-4 transition-colors focus-within:border-primary">
          <Search className="size-4 shrink-0 text-muted-foreground" />
          <Input
            ref={inputRef}
            placeholder="Suchen ..."
            className="h-auto min-w-0 flex-1 border-none bg-transparent p-0 text-sm shadow-none focus-visible:ring-0"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleInputKeyDown}
          />
          <button
            type="button"
            aria-label="Suche schließen"
            onClick={closeMobile}
            className="shrink-0 text-muted-foreground hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        </div>
        {resultsDropdown}
      </div>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => onMobileOpenChange(true)}
        aria-label="Suche öffnen"
        className="flex size-11 shrink-0 items-center justify-center rounded-full border bg-card text-muted-foreground transition-colors hover:bg-sidebar-accent compact:hidden"
      >
        <Search className="size-4" />
      </button>

      <div
        ref={containerRef}
        className="relative hidden h-11 w-full min-w-0 shrink compact:block compact:w-96"
      >
        <div className="flex h-11 w-full items-center gap-2 rounded-full border bg-card px-4 transition-colors hover:bg-sidebar-accent focus-within:border-primary focus-within:bg-card focus-within:hover:bg-card">
          <Search className="size-4 shrink-0 text-muted-foreground" />
          <Input
            placeholder="Suchen ..."
            className="h-auto flex-1 border-none bg-transparent p-0 text-sm shadow-none focus-visible:ring-0"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleInputKeyDown}
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
            shortcutsEnabled && (
              <button
                type="button"
                onClick={onOpenPalette}
                className="hidden shrink-0 rounded-md bg-muted px-2 py-1 font-sans text-xs text-muted-foreground hover:text-foreground sm:inline-block"
              >
                Strg K
              </button>
            )
          )}
        </div>
        {resultsDropdown}
      </div>
    </>
  );
}
