"use client";

import { Pencil, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

/** Ersetzt das bisherige ⋮-Kebab-Menü in Listen-Ansichten durch immer
 * sichtbare Bearbeiten-/Löschen-Icon-Buttons (Nutzervorgabe, 2026-08-16,
 * 1:1 nach Bildvorlage der Tags-Seite, dann global auf alle Listen
 * ausgerollt). Quadratisch (`rounded-lg`) statt der sonst für Icon-Buttons
 * üblichen `rounded-full`-Basis aus `ui/button.tsx` – bewusster Kontrast
 * zu echten "runden" Icon-Buttons wie Glocke/Avatar im Header, die einen
 * anderen Zweck haben (Trigger, kein Zeilen-Aktion-Paar). Löschen steht
 * immer zuletzt/rechts (Nutzervorgabe, 2026-08-18) – ein separates
 * Papierkorb-Icon/Overlay gibt es bewusst nicht mehr, seit Papierkorb
 * einen eigenen Sidebar-Eintrag hat. */
export function RowActionButtons({
  onEdit,
  onDelete,
  editLabel = "Bearbeiten",
  deleteLabel = "Löschen",
  size = "icon",
  className,
  extra,
  tooltips = false,
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
  /** Blendet zusätzlich einen Tooltip pro Button ein (Nutzervorgabe,
   * 2026-08-31, zunächst nur für die Menü-Verwaltung: dort stehen in einer
   * Zeile bis zu vier Icon-Buttons nebeneinander, deren Bedeutung ohne
   * Beschriftung nicht selbsterklärend ist). Standardmäßig aus, damit sich
   * an den übrigen Listen nichts ändert – die `aria-label`s gibt es
   * unabhängig davon immer. */
  tooltips?: boolean;
}) {
  /** Base UI erwartet beim `render`-Muster einen Trigger ohne eigene
   * Kinder – das Icon hängt am TooltipTrigger, nicht am Button (Vorbild:
   * user-restore-button.tsx). Ohne `tooltips` bleibt es exakt der
   * bisherige, unverpackte Button. */
  function iconButton(
    props: React.ComponentProps<typeof Button>,
    icon: React.ReactNode,
    tooltipLabel: string,
  ) {
    if (!tooltips) return <Button {...props}>{icon}</Button>;
    return (
      <Tooltip>
        <TooltipTrigger render={<Button {...props} />}>{icon}</TooltipTrigger>
        <TooltipContent>{tooltipLabel}</TooltipContent>
      </Tooltip>
    );
  }

  return (
    <div className={cn("flex items-center justify-center gap-2", className)}>
      {extra}
      {onEdit &&
        iconButton(
          {
            type: "button",
            variant: "outline",
            size,
            className: "rounded-lg border-border",
            onClick: onEdit,
            "aria-label": editLabel,
          },
          <Pencil />,
          "Bearbeiten",
        )}
      {onDelete &&
        iconButton(
          {
            type: "button",
            variant: "destructive",
            size,
            className: "rounded-lg",
            onClick: onDelete,
            "aria-label": deleteLabel,
          },
          <Trash2 />,
          "Löschen",
        )}
    </div>
  );
}
