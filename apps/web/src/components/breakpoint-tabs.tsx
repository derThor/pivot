"use client";

import { Monitor, Smartphone, Tablet } from "lucide-react";

import { cn } from "@/lib/utils";

/** Die drei Stufen, in denen Abstände in dieser Anwendung eingestellt
 * werden. Die Schlüssel sind identisch mit `ResponsiveSpacing` in
 * `@pivot/blocks` – dieselbe Sache soll überall gleich heißen.
 *
 * Mobil ist der Grundwert, Tablet greift ab 768px, Desktop ab 1024px; ohne
 * eigenen Wert erbt jede Stufe die nächstkleinere (siehe `.block-spacing`
 * und `.page-spacing` in globals.css). */
export const BREAKPOINT_TABS = [
  { value: "mobile" as const, label: "Mobil", icon: Smartphone },
  { value: "tablet" as const, label: "Tablet", icon: Tablet },
  { value: "desktop" as const, label: "Desktop", icon: Monitor },
];

export type BreakpointTab = (typeof BREAKPOINT_TABS)[number]["value"];

/** Die Reiterleiste über einem Abstandsfeld.
 *
 * 2026-09-05 aus dem Abstände-Dialog des Designers herausgelöst: dieselbe
 * Leiste stand da schon dreimal (Designer, Menüpunkt-Dialog, Einstellungen
 * → Frontend), und beim Ergänzen der Tablet-Stufe musste jede einzeln
 * angefasst werden. Eine vierte Stufe wäre sonst ein viertes Copy-Paste. */
export function BreakpointTabs({
  value,
  onChange,
  className,
}: {
  value: BreakpointTab;
  onChange: (value: BreakpointTab) => void;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex gap-1 rounded-lg border border-border bg-muted p-1",
        className,
      )}
    >
      {BREAKPOINT_TABS.map((tab) => {
        const Icon = tab.icon;
        return (
          <button
            key={tab.value}
            type="button"
            onClick={() => onChange(tab.value)}
            className={cn(
              "flex flex-1 items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm font-medium transition-colors",
              value === tab.value
                ? "border-primary bg-card shadow-sm"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className="size-4" />
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
