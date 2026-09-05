import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/**
 * Platzhalter für Dinge, die die Verwaltung erst NACH dem Rendern nachlädt
 * (Nutzervorgabe, 2026-09-05: *"mach ein skeleton bei dingen, die geladen
 * werden im backend und verzögert kommen"*).
 *
 * Betroffen ist alles, was im Browser nachgeholt wird statt serverseitig
 * mitzukommen: das Template-Manifest (es lebt in der Website, siehe
 * knowledge-base/frontend/template-manifest.md), die Liste der
 * hochgeladenen Templates, die Auswahl von Formularen und Menüs in einem
 * Baustein. Vorher stand dort jeweils ein Satz „… wird geladen"; ein
 * Platzhalter in der Form des Kommenden zeigt stattdessen, WAS gleich
 * erscheint, und die Seite springt beim Eintreffen nicht.
 *
 * Bewusst zurückhaltend gehalten: Höhen entsprechen den echten Elementen
 * (Eingabefeld 2.25rem, Zeile 4.5rem), damit der Sprung klein bleibt.
 */

/** Ein Formularfeld: Beschriftung über Eingabefeld. */
export function FieldSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <Skeleton className="h-3.5 w-24" />
      <Skeleton className="h-9 w-full" />
    </div>
  );
}

/** Mehrere Felder im zweispaltigen Raster – die Form, in der die
 * Template-Einstellungen erscheinen. `groups` zeichnet zusätzlich die
 * Gruppen-Überschriften vor. */
export function FieldGridSkeleton({
  fields = 6,
  groups = 2,
  className,
}: {
  fields?: number;
  groups?: number;
  className?: string;
}) {
  const perGroup = Math.max(1, Math.ceil(fields / Math.max(1, groups)));
  return (
    <div className={cn("flex flex-col gap-6", className)}>
      {Array.from({ length: groups }).map((_, group) => (
        <div key={group} className="flex flex-col gap-4">
          <Skeleton className="h-3 w-20" />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {Array.from({ length: perGroup }).map((_, field) => (
              <FieldSkeleton key={field} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/** Zeilen einer Liste mit Icon-Kästchen, zwei Textzeilen und einem Knopf
 * rechts – die Form der Template-Liste. */
export function ListRowsSkeleton({
  rows = 3,
  className,
}: {
  rows?: number;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {Array.from({ length: rows }).map((_, row) => (
        <div
          key={row}
          className="flex items-center justify-between gap-3 rounded-lg border border-border p-4"
        >
          <div className="flex items-center gap-3">
            <Skeleton className="size-9 shrink-0" />
            <div className="flex flex-col gap-1.5">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-3 w-28" />
            </div>
          </div>
          <Skeleton className="h-9 w-24" />
        </div>
      ))}
    </div>
  );
}
