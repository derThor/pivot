"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { ContentStatus } from "@/lib/api-server";

/** Filter-Leiste über der Seiten-Tabelle (Nutzervorgabe, 2026-09-01:
 * "baue das auch bei seiten ein. nur entsprechend für seiten. also alle,
 * veröffentlicht, geplant, entwurf, archiv und eine suche") – 1:1 nach der
 * Papierkorb-Leiste (`trash-view.tsx`), inklusive der kleinen, hellen
 * Zähler neben dem Pill-Text. Gefiltert wird serverseitig über die
 * URL-Parameter `status`/`q`, die Leiste selbst hält nur den Eingabewert
 * der Suche. */
export function ContentFilterBar({
  counts,
}: {
  counts: Record<ContentStatus, number> & { all: number };
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeStatus = searchParams.get("status") ?? "all";
  const [query, setQuery] = useState(searchParams.get("q") ?? "");

  const filters: { value: string; label: string; count: number }[] = [
    { value: "all", label: "Alle", count: counts.all },
    { value: "PUBLISHED", label: "Veröffentlicht", count: counts.PUBLISHED },
    { value: "SCHEDULED", label: "Geplant", count: counts.SCHEDULED },
    { value: "DRAFT", label: "Entwurf", count: counts.DRAFT },
    { value: "ARCHIVED", label: "Archiv", count: counts.ARCHIVED },
  ];

  // `page` fällt bei jeder Filteränderung weg – sonst landet man auf einer
  // Seite 3, die es im gefilterten Ergebnis gar nicht mehr gibt (gleiches
  // Vorgehen wie in `users-filter-bar.tsx`).
  function updateParam(key: string, value: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (value && value !== "all") params.set(key, value);
    else params.delete(key);
    params.delete("page");
    router.push(`?${params.toString()}`);
  }

  function handleSearchChange(value: string) {
    setQuery(value);
    updateParam("q", value || null);
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex flex-wrap items-center gap-1 rounded-xl bg-secondary p-1">
        {filters.map((filter) => {
          const active = activeStatus === filter.value;
          return (
            <button
              key={filter.value}
              type="button"
              onClick={() => updateParam("status", filter.value)}
              className={cn(
                "flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-sm font-medium transition-colors",
                active
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {filter.label}
              <span className="text-xs text-muted-foreground">
                {filter.count}
              </span>
            </button>
          );
        })}
      </div>
      <div className="flex h-9 min-w-56 flex-1 items-center gap-2 rounded-xl border border-border bg-card px-4 sm:flex-none">
        <Search className="size-4 shrink-0 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => handleSearchChange(e.target.value)}
          placeholder="Seiten durchsuchen"
          className="h-auto flex-1 border-none bg-transparent p-0 text-sm shadow-none focus-visible:ring-0"
        />
      </div>
    </div>
  );
}
