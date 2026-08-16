// Rein dekorative, deterministische Farbzuordnung für Rollen-Badges
// (gleiches Muster wie `tagDotColor` in `tag-colors.ts`) – Rollen haben kein
// eigenes `color`-Feld im Schema, die Farbe wird über einen Hash der ID aus
// einer festen Palette gewählt, damit dieselbe Rolle über die Nutzer-Tabelle
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

export function roleBadgeColor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  }
  return ROLE_BADGE_COLORS[hash % ROLE_BADGE_COLORS.length];
}
