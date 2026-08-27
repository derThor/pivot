// Zentrale Quelle für Label + Farbe des Master/Client-Badges (Nutzervorgabe,
// 2026-08-25: "für Master nimm diese Farbe" / "für Client ein Blau" – vorher
// in mehreren Dateien unabhängig dupliziert, u.a. mit unterschiedlichen
// Master-Farben je Stelle). Genutzt von app-sidebar.tsx und
// master-client-card.tsx. Master-Farbton als exakter lab()-Wert
// (Nutzervorgabe, 2026-08-25) statt der genäherten Tailwind-Palette.
// Nutzervorgabe, 2026-08-27: "Client Badge standardisieren" – das
// bisherige `bg-blue-100 text-blue-700` hatte keine eigene Dark-Mode-
// Variante (im Dark Mode blass/falsch), jetzt die kanonische
// `badge--blue`-Klasse (siehe ui/badge.tsx/globals.css), dieselbe wie bei
// allen anderen Badges im Blau-Ton.
export const DEPLOYMENT_MODE_BADGE = {
  master: {
    label: "Master",
    className: "bg-[lab(93_-4.76_94.87)] text-black",
  },
  slave: { label: "Client", className: "badge--blue border-0" },
} satisfies Record<"master" | "slave", { label: string; className: string }>;
