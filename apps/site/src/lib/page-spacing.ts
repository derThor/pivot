import type { CSSProperties } from "react";
import type { PageSpacing } from "@/lib/api";

/** Der am Menüpunkt gesetzte Abstand oben/unten als Inline-Stil
 * (Nutzervorgabe, 2026-09-03), getrennt nach Mobil, Tablet und Desktop.
 *
 * Wie bei den Abständen im Designer läuft das über CSS-Variablen und die
 * Klasse `.page-spacing` (globals.css) statt über feste Werte: nur so kann
 * derselbe Knoten je Bildschirmbreite einen anderen Abstand haben – ein
 * Inline-`padding-top` kennt keinen Breakpoint. Fehlt eine Stufe, erbt sie
 * die nächstkleinere (Rückfall in der CSS-Variablen-Kette).
 *
 * Bewusst `padding` und nicht `margin`, obwohl die Felder "Abstand" heißen:
 * `<main>` hat oben weder Polsterung noch Rahmen – ein `margin-top` am Kind
 * schlüge dort nach außen durch (Margin Collapsing) und verschöbe die
 * ganze Bahn statt nur den Inhalt. Sichtbar ist das Ergebnis dasselbe.
 *
 * `undefined` statt `{}`, wenn nichts gesetzt ist: dann steht am Element
 * gar kein `style` und die Vorgabe des Templates bleibt unangetastet. */
export function pageSpacingStyle(
  spacing?: PageSpacing | null,
): CSSProperties | undefined {
  if (!spacing) return undefined;
  const vars: Record<string, string> = {};
  const set = (name: string, value: number | null) => {
    if (value !== null) vars[name] = `${value}px`;
  };
  set("--page-spacing-top-mobile", spacing.topMobile);
  set("--page-spacing-bottom-mobile", spacing.bottomMobile);
  set("--page-spacing-top-tablet", spacing.topTablet);
  set("--page-spacing-bottom-tablet", spacing.bottomTablet);
  set("--page-spacing-top-desktop", spacing.topDesktop);
  set("--page-spacing-bottom-desktop", spacing.bottomDesktop);
  if (Object.keys(vars).length === 0) return undefined;
  return vars as CSSProperties;
}
