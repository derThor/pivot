import { Manrope, IBM_Plex_Mono } from "next/font/google";

/** PROJEKTEIGENE DATEI – gehört zum Frontend-Template dieser Installation,
 * genau wie `app/globals.css` und `components/site-logo.tsx`. Eine andere
 * Installation ersetzt sie durch ihre eigenen Schriften; `app/layout.tsx`
 * bleibt dabei unangetastet und wandert weiter zwischen den Projekten.
 *
 * **Warum eine .ts und keine fonts.css** (Nutzerfrage, 2026-09-03):
 * `next/font` lädt die Schriftdateien beim Bauen herunter, liefert sie
 * lokal aus und legt die CSS-Variablen selbst an. Eine reine CSS-Datei
 * könnte dasselbe nur über `@import` von Google Fonts – dann stünde bei
 * jedem Besucher wieder ein Aufruf zu einem Dritten in der Seite, was auf
 * einer Website mit Datenschutzerklärung der schlechtere Tausch ist.
 *
 * Die Zuordnung, WELCHE Schrift wo greift, steht weiterhin in
 * `globals.css` (`--font-sans`, `--font-mono`) – hier wird nur bestimmt,
 * welche Schriften überhaupt geladen werden. Wer eine andere Schrift will,
 * tauscht sie hier und passt dort die Variablennamen an. */
const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
});

/** Kommt an `<html>`. Enthält alle Variablen-Klassen dieses Templates. */
export const fontVariables = `${manrope.variable} ${plexMono.variable}`;
