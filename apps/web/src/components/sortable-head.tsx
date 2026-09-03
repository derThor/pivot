"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";

import { TableHead } from "@/components/ui/table";
import { cn } from "@/lib/utils";

/**
 * Sortierbarer Spaltenkopf (Nutzervorgabe, 2026-09-03: "eine
 * Sortierfunktion in allen Listen"). Ein Klick sortiert nach dieser
 * Spalte, ein zweiter dreht die Richtung um, ein dritter nimmt die
 * Sortierung wieder heraus – die Liste steht dann wieder in ihrer
 * Standard-Reihenfolge.
 *
 * **Der Zustand steht in der URL, nicht im Bauteil.** Die Listen holen
 * ihre Daten serverseitig und blättern serverseitig; ein Sortieren nur
 * über die gerade geladene Seite würde eine "Seite 2" zeigen, die auf
 * einer anderen Grundmenge beruht. Gleiches Muster wie die Paginierung
 * daneben.
 *
 * Beim Umschalten springt die Liste zurück auf Seite 1 – Seite 7 einer
 * neu sortierten Liste zeigt etwas völlig anderes als vorher.
 *
 * Andere Query-Parameter bleiben erhalten (Suchbegriff, Filter, die
 * Seitenzahlen anderer Karten auf derselben Seite).
 */
export function SortableHead({
  field,
  children,
  className,
  /** Name des Seitenzahl-Parameters dieser Liste, falls nicht `page`. */
  pageParam = "page",
}: {
  field: string;
  children: React.ReactNode;
  className?: string;
  pageParam?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const activeField = searchParams.get("sortBy");
  const activeDir = searchParams.get("sortDir") === "asc" ? "asc" : "desc";
  const isActive = activeField === field;

  function toggle() {
    const next = new URLSearchParams(searchParams.toString());
    if (!isActive) {
      next.set("sortBy", field);
      next.set("sortDir", "asc");
    } else if (activeDir === "asc") {
      next.set("sortDir", "desc");
    } else {
      next.delete("sortBy");
      next.delete("sortDir");
    }
    next.delete(pageParam);
    const query = next.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  }

  const Icon = !isActive
    ? ChevronsUpDown
    : activeDir === "asc"
      ? ArrowUp
      : ArrowDown;

  return (
    <TableHead className={className}>
      <button
        type="button"
        onClick={toggle}
        aria-label={`Nach ${typeof children === "string" ? children : field} sortieren`}
        className={cn(
          "group inline-flex items-center gap-1.5 text-xs font-medium tracking-wide uppercase transition-colors hover:text-foreground",
          isActive && "text-foreground",
        )}
      >
        {children}
        <Icon
          className={cn(
            "size-3.5 transition-opacity",
            // Der Doppelpfeil ist nur ein Hinweis, dass die Spalte
            // sortierbar ist – dauerhaft sichtbar wäre er in einer Zeile
            // mit fünf Spalten reines Rauschen.
            isActive ? "opacity-100" : "opacity-0 group-hover:opacity-60",
          )}
        />
      </button>
    </TableHead>
  );
}
