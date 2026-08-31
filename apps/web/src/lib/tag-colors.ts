// Rein dekorative, deterministische Farbzuordnung für Tag-Punkte/-Pills
// (Nutzervorgabe, 2026-08-16, 1:1 nach Bildvorlage) – Tags haben kein
// eigenes `color`-Feld im Schema, die Farbe wird über einen Hash der ID
// aus einer festen Palette gewählt, damit derselbe Tag über Pagination/
// Übersichtsleiste hinweg immer dieselbe Farbe behält.
const TAG_DOT_COLORS = [
  "bg-green-500",
  "bg-blue-500",
  "bg-amber-500",
  "bg-purple-500",
  "bg-pink-500",
  "bg-cyan-500",
  "bg-emerald-500",
  "bg-red-500",
] as const;

export function tagDotColor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  }
  return TAG_DOT_COLORS[hash % TAG_DOT_COLORS.length];
}

/** Gleiches Prinzip wie `tagDotColor`, für den farbigen Balken/Punkt einer
 * Kategorie (Kategorien-Seite, Nutzervorgabe 2026-08-31, 1:1 nach
 * Bildvorlage) – Category hat ebenfalls kein eigenes `color`-Feld. Eigener
 * Name statt Wiederverwendung von `tagDotColor`, damit an der Aufrufstelle
 * klar bleibt, dass es sich um eine Kategorie handelt. */
export const categoryColor = tagDotColor;
