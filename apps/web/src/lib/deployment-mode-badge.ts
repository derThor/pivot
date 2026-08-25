// Zentrale Quelle für Label + Farbe des Master/Client-Badges (Nutzervorgabe,
// 2026-08-25: "für Master nimm diese Farbe" / "für Client ein Blau" – vorher
// in mehreren Dateien unabhängig dupliziert, u.a. mit unterschiedlichen
// Master-Farben je Stelle). Genutzt von app-sidebar.tsx und
// master-client-card.tsx.
export const DEPLOYMENT_MODE_BADGE = {
  master: { label: "Master", className: "bg-yellow-400 text-black" },
  slave: { label: "Client", className: "bg-blue-100 text-blue-700" },
} satisfies Record<"master" | "slave", { label: string; className: string }>;
