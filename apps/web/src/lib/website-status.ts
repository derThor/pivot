import type { WebsiteStatus } from "@/lib/api-server";

// Zentrale Quelle für Label + Farbe pro Website-Status (Nutzervorgabe,
// 2026-08-25: vorher in mehreren Dateien unabhängig dupliziert – dadurch
// zeigte "Entwicklung" je nach Stelle grau oder gelb statt überall
// gleich). Genutzt von websites-view.tsx, master-client-card.tsx und
// website-check-details-dialog.tsx.
export const WEBSITE_STATUS_BADGE: Record<
  WebsiteStatus,
  { label: string; className: string }
> = {
  live: { label: "Live", className: "bg-green-100 text-green-700" },
  development: {
    label: "Entwicklung",
    className: "bg-purple-100 text-purple-700",
  },
  locked: { label: "Gesperrt", className: "bg-red-100 text-red-700" },
};
