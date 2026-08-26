// Nutzervorgabe, 2026-08-26: feste, exakt vorgegebene Farben je bekanntem
// Rollennamen (Bildvorlage "ROLLEN-BADGES") statt der bisherigen
// Hash-Zuordnung aus einer Palette – nur für Rollennamen OHNE Eintrag hier
// (z.B. selbst angelegte Rollen ohne feste Vorgabe) greift weiterhin die
// deterministische Hash-Zuordnung als Fallback, damit auch die keine
// beliebige, aber stabile Farbe über die Nutzer-Tabelle hinweg behalten.
// Exakte Werte liegen als `.badge--*`-Klassen in globals.css (inset
// box-shadow als "Rahmen"), hier nur noch die Zuordnung Rollenname → Klasse.
const FIXED_ROLE_BADGE_COLORS: Record<string, string> = {
  Administrator: "badge--admin border-0",
  Chefredaktion: "badge--chefred border-0",
  Redakteur: "badge--redakteur border-0",
  Autor: "badge--autor border-0",
  Medienpflege: "badge--medien border-0",
  "Formular-Manager": "badge--formular border-0",
  "Gast / Praktikum": "badge--gast border-0",
};

// Fallback-Palette für Rollennamen ohne feste Vorgabe – Rollen haben kein
// eigenes `color`-Feld im Schema, die Farbe wird über einen Hash der ID aus
// dieser Palette gewählt, damit dieselbe Rolle über die Nutzer-Tabelle
// hinweg immer dieselbe Farbe behält.
const ROLE_BADGE_COLORS = [
  "bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400",
  "bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-400",
  "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400",
  "bg-pink-100 text-pink-700 dark:bg-pink-500/20 dark:text-pink-400",
  "bg-cyan-100 text-cyan-700 dark:bg-cyan-500/20 dark:text-cyan-400",
  "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400",
  "bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-400",
  "bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-400",
] as const;

export function roleBadgeColor(id: string, name?: string): string {
  if (name && name in FIXED_ROLE_BADGE_COLORS) {
    return FIXED_ROLE_BADGE_COLORS[name];
  }
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  }
  return ROLE_BADGE_COLORS[hash % ROLE_BADGE_COLORS.length];
}
