"use client";

import { Pencil, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Ersetzt das bisherige ⋮-Kebab-Menü in Listen-Ansichten durch immer
 * sichtbare Bearbeiten-/Löschen-Icon-Buttons (Nutzervorgabe, 2026-08-16,
 * 1:1 nach Bildvorlage der Tags-Seite, dann global auf alle Listen
 * ausgerollt). Quadratisch (`rounded-lg`) statt der sonst für Icon-Buttons
 * üblichen `rounded-full`-Basis aus `ui/button.tsx` – bewusster Kontrast
 * zu echten "runden" Icon-Buttons wie Glocke/Avatar im Header, die einen
 * anderen Zweck haben (Trigger, kein Zeilen-Aktion-Paar). */
export function RowActionButtons({
  onEdit,
  onDelete,
  editLabel = "Bearbeiten",
  deleteLabel = "Löschen",
  size = "icon",
  className,
  extra,
}: {
  /** Weggelassen = kein Bearbeiten-Button (z.B. webhooks-manager.tsx, wo
   * es nur eine Löschen-Aktion gibt). */
  onEdit?: () => void;
  /** Weggelassen = kein Löschen-Button (z.B. bei fehlender Berechtigung/
   * Selbstlöschschutz, siehe user-row-actions.tsx). */
  onDelete?: () => void;
  editLabel?: string;
  deleteLabel?: string;
  size?: "icon" | "icon-sm";
  className?: string;
  /** Zusätzliche Icon-Buttons vor Bearbeiten/Löschen (z.B. "Vorschau",
   * "Öffnen", "Link kopieren") – gleicher quadratischer Stil. */
  extra?: React.ReactNode;
}) {
  return (
    <div className={cn("flex items-center justify-center gap-2", className)}>
      {extra}
      {onEdit && (
        <Button
          type="button"
          variant="outline"
          size={size}
          className="rounded-lg border-[#D4D4D4]"
          onClick={onEdit}
          aria-label={editLabel}
        >
          <Pencil />
        </Button>
      )}
      {onDelete && (
        <Button
          type="button"
          variant="destructive"
          size={size}
          className="rounded-lg"
          onClick={onDelete}
          aria-label={deleteLabel}
        >
          <Trash2 />
        </Button>
      )}
    </div>
  );
}
