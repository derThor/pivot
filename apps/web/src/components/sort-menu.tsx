"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowDownUp, Check } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export interface SortOption {
  /** Feldname aus der Positivliste der jeweiligen Liste. */
  field: string;
  label: string;
  dir?: "asc" | "desc";
}

/**
 * Sortier-Menü für Listen OHNE Tabellenkopf – aktuell die Mediathek
 * (Kachelraster) und die Kategorien-Übersicht (eigene Liste). Wo es
 * Spaltenköpfe gibt, bleibt `SortableHead` das Mittel der Wahl: dort ist
 * die Spalte selbst die natürliche Schaltfläche.
 *
 * Verhalten und Zustand sind identisch – die Sortierung steht in der URL,
 * andere Parameter bleiben erhalten, beim Umschalten geht es zurück auf
 * Seite 1 (siehe SortableHead für die Begründung).
 */
export function SortMenu({
  options,
  pageParam = "page",
  paramPrefix = "",
  className,
}: {
  options: SortOption[];
  pageParam?: string;
  /** Zusätzliche Klassen für die Schaltfläche – damit sich das Menü der
   * Umgebung anpasst, in der es steht. In der Mediathek sitzt es in einer
   * Reihe mit den Filter-Pillen und übernimmt deren Form und Höhe
   * (Nutzervorgabe, 2026-09-03). */
  className?: string;
  /** Namensvorsatz der Query-Parameter. Nötig, sobald ZWEI sortierbare
   * Listen auf derselben Seite stehen – die Kategorien-Seite zeigt links
   * die Kategorien und rechts deren Beiträge; ohne Vorsatz würden beide
   * dasselbe `sortBy` lesen und sich gegenseitig umsortieren. */
  paramPrefix?: string;
}) {
  const byField = `${paramPrefix}sortBy`;
  const byDir = `${paramPrefix}sortDir`;
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const activeField = searchParams.get(byField);
  const activeDir = searchParams.get(byDir) === "asc" ? "asc" : "desc";
  const active = options.find(
    (o) => o.field === activeField && (o.dir ?? "desc") === activeDir,
  );

  function apply(option: SortOption | null) {
    const next = new URLSearchParams(searchParams.toString());
    if (option) {
      next.set(byField, option.field);
      next.set(byDir, option.dir ?? "desc");
    } else {
      next.delete(byField);
      next.delete(byDir);
    }
    next.delete(pageParam);
    const query = next.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            type="button"
            variant="outline"
            size="sm"
            className={cn("border-button-border", className)}
          />
        }
      >
        <ArrowDownUp />
        {active ? active.label : "Sortieren"}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {/* "Standard" nimmt die Sortierung wieder heraus – dasselbe wie der
            dritte Klick auf einen Spaltenkopf. */}
        <DropdownMenuItem onClick={() => apply(null)}>
          {!active && <Check className="size-4" />}
          Standard
        </DropdownMenuItem>
        {options.map((option) => (
          <DropdownMenuItem
            key={`${option.field}-${option.dir ?? "desc"}`}
            onClick={() => apply(option)}
          >
            {active === option && <Check className="size-4" />}
            {option.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
