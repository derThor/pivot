import type { WebsiteStatus } from "@/lib/api-server";

// Zentrale Quelle für Label + Farbe pro Website-Status (Nutzervorgabe,
// 2026-08-25: vorher in mehreren Dateien unabhängig dupliziert – dadurch
// zeigte "Entwicklung" je nach Stelle grau oder gelb statt überall
// gleich). Genutzt von websites-view.tsx, master-client-card.tsx und
// website-check-details-dialog.tsx.
// Nutzervorgabe, 2026-08-26: feste Badge-Palette (siehe ui/badge.tsx) statt
// Ad-hoc-Tailwind-Tönen – "Entwicklung" bewusst lila (Nutzervorgabe:
// "in lila", nutzt dieselben Werte wie `.badge--chefred`), "Gesperrt"
// bewusst "ink" (kein "Fehler"-Rot in der vorgegebenen Palette, "ink" ist
// dort die einzige stark-negative Farbe).
export const WEBSITE_STATUS_BADGE: Record<
  WebsiteStatus,
  { label: string; className: string }
> = {
  live: { label: "Live", className: "badge--green border-0" },
  development: {
    label: "Entwicklung",
    className: "badge--chefred border-0",
  },
  locked: { label: "Gesperrt", className: "badge--ink border-0" },
};
