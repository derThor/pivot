"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowDownUp, Check } from "lucide-react";

import { Button } from "@/components/ui/button";
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
}: {
  options: SortOption[];
  pageParam?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const activeField = searchParams.get("sortBy");
  const activeDir = searchParams.get("sortDir") === "asc" ? "asc" : "desc";
  const active = options.find(
    (o) => o.field === activeField && (o.dir ?? "desc") === activeDir,
  );

  function apply(option: SortOption | null) {
    const next = new URLSearchParams(searchParams.toString());
    if (option) {
      next.set("sortBy", option.field);
      next.set("sortDir", option.dir ?? "desc");
    } else {
      next.delete("sortBy");
      next.delete("sortDir");
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
            className="border-button-border"
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
