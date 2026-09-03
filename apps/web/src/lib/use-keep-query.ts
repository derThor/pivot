"use client";

import { useSearchParams } from "next/navigation";

/**
 * Baut Paginierungs-Links, die ALLE aktuellen Query-Parameter behalten und
 * nur die Seitenzahl austauschen.
 *
 * Entstanden aus einem Fehlerbild (2026-09-03): mehrere Listen bauten ihre
 * Seitenlinks aus einer handgepflegten Aufzählung ihrer Parameter. Sobald
 * ein Parameter dazukam – hier die Sortierung –, fiel er beim Blättern
 * still weg. Bei den Benutzern gingen auf diesem Weg sogar die Filter
 * verloren, lange bevor es eine Sortierung gab.
 *
 * Der Hook liest den echten Stand aus der URL, statt ihn nachzubilden –
 * damit kann kein künftiger Parameter mehr vergessen werden.
 */
export function useKeepQuery(pageParam = "page") {
  const searchParams = useSearchParams();
  return (page: number) => {
    const next = new URLSearchParams(searchParams.toString());
    next.set(pageParam, String(page));
    return `?${next.toString()}`;
  };
}
