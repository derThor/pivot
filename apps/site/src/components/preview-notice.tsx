/** Hinweisleiste über einer Vorschau. Macht sichtbar, dass der gezeigte
 * Stand nicht der öffentliche sein muss – ohne sie ließe sich eine
 * Vorschau-URL nicht von der echten Seite unterscheiden.
 *
 * Bewusst schlicht und ohne eigene Farbtokens: `apps/site` bringt nur die
 * wenigen Tokens mit, die `@pivot/blocks` braucht (siehe globals.css). */
export function PreviewNotice() {
  return (
    <div className="mb-8 rounded-lg border border-border bg-muted px-4 py-3 text-sm">
      <strong className="font-semibold">Vorschau.</strong> Dieser Stand ist
      möglicherweise noch nicht veröffentlicht und nur über diesen Link
      sichtbar.
    </div>
  );
}
