/** PROJEKTEIGENE DATEI – gehört zum Frontend-Template dieser Installation,
 * genau wie `template/fonts.ts` und `app/globals.css`.
 *
 * Sie ist die EINZIGE Stelle, an der steht, ob und welches Bildlogo diese
 * Website führt. `components/site-logo.tsx` ist dadurch geteilter Code und
 * darf zwischen den Projekten wandern – es liest nur, was hier steht.
 *
 * Der Grund für diese Umkehrung (2026-09-03): Bei einem Merge aus einem
 * anderen Repository kommen dessen Dateien mit, sobald nur DORT etwas
 * geändert wurde – `merge=ours` schützt nur bei beidseitigen Änderungen.
 * Zweimal ist so Pivots Logo auf einer fremden Website gelandet. Jetzt
 * dürfen fremde Logo-Dateien ruhig mitwandern: referenziert wird nur, was
 * hier eingetragen ist. Eine Installation ohne Eintrag zeigt ihren
 * Website-Titel als Wortmarke.
 *
 * Die Maße sind die der Datei, nicht die Anzeigegröße – daraus rechnet
 * `SiteLogo` die Breite zur festen Anzeigehöhe aus. */
export interface BrandLogo {
  /** Pfad unterhalb von `public/`. */
  src: string;
  /** Echte Bildmaße, für das Seitenverhältnis. */
  width: number;
  height: number;
}

/** Für helle Flächen (Kopfbereich). `null` = kein Bildlogo, Wortmarke. */
export const brandLogoOnLight: BrandLogo | null = {
  src: "/brand/logo-on-light.png",
  width: 817,
  height: 336,
};

/** Für dunkle Flächen (Fußbereich). */
export const brandLogoOnDark: BrandLogo | null = {
  src: "/brand/logo-on-dark.png",
  width: 817,
  height: 336,
};
