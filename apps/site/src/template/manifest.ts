import type { TemplateManifest } from "@pivot/blocks";

/** PROJEKTEIGENE DATEI – gehört zum Frontend-Template dieser Installation,
 * genau wie `template/brand.ts`, `template/fonts.ts` und `app/globals.css`.
 *
 * Hier beschreibt sich das Template selbst: welche Bereiche es rendert und
 * welche Einstellungen es kennt. Die Verwaltung liest das über
 * `GET /api/template` und baut daraus die Oberfläche unter Einstellungen →
 * Frontend – sie kennt kein einziges dieser Felder namentlich
 * (Nutzerentscheidung, 2026-09-05: *"beim frontend muss das für jedes
 * template, egal wie es aussieht, gehen"*).
 *
 * Ein anderes Projekt legt hier seine eigene Datei ab: andere Farben,
 * andere Bereiche, andere Schalter – ohne eine Zeile in `apps/web`.
 *
 * **Die Vorgaben (`default`) sind die Werte, die bis 2026-09-05 fest in
 * `globals.css` standen.** Ohne gespeicherte Werte sieht die Seite deshalb
 * exakt aus wie vorher; die Datei ist die Quelle, `globals.css` nur noch
 * der Rückfall, falls die Website die Einstellungen nicht laden kann.
 *
 * Beim Erweitern: `key` stabil halten (er ist der Name in der Datenbank)
 * und `cssVar` nur setzen, wenn das Template die Variable auch benutzt. */
export const templateManifest: TemplateManifest = {
  name: "Pivot",
  version: "1.0",

  regions: [
    {
      key: "header",
      label: "Kopfbereich",
      description:
        "Klebender Balken über jeder Seite. Ohne Logo wirkt er unfertig – der Baustein ist deshalb als benötigt markiert.",
      required: ["logo"],
    },
    {
      key: "footer",
      label: "Fußbereich",
      description:
        "Dunkler Abschluss jeder Seite mit den Footer-Menüs und der Rechtstexte-Spalte.",
    },
  ],

  settings: [
    // ---- Layout ----------------------------------------------------
    {
      key: "contentWidth",
      type: "number",
      label: "Inhaltsbreite",
      description:
        "Breite der Inhaltsbahn. Bausteine mit der Ausrichtung „Volle Fensterbreite“ brechen bewusst daraus aus.",
      group: "Layout",
      unit: "px",
      min: 640,
      max: 2400,
      default: 1180,
      cssVar: "--content-width",
    },
    {
      key: "headerSticky",
      type: "boolean",
      label: "Kopfbereich klebt beim Scrollen",
      group: "Layout",
      default: true,
    },
    {
      key: "headerStyle",
      type: "select",
      label: "Kopfbereich-Fläche",
      description:
        "Weichgezeichnet lässt den Inhalt durchscheinen, gefüllt setzt eine deckende Fläche.",
      group: "Layout",
      options: [
        ["blur", "Weichgezeichnet"],
        ["solid", "Gefüllt"],
      ],
      default: "blur",
      showIf: { headerSticky: true },
    },

    // ---- Farben ----------------------------------------------------
    {
      key: "colorBackground",
      type: "color",
      label: "Seitengrund",
      group: "Farben",
      default: "#fbfbf9",
      cssVar: "--color-background",
    },
    {
      key: "colorForeground",
      type: "color",
      label: "Schriftfarbe",
      group: "Farben",
      default: "#0e1116",
      cssVar: "--color-foreground",
    },
    {
      key: "colorMuted",
      type: "color",
      label: "Abgesetzte Fläche",
      description: "Grund von Karten und ruhigen Abschnitten.",
      group: "Farben",
      default: "#f2f2ec",
      cssVar: "--color-muted",
    },
    {
      key: "colorBorder",
      type: "color",
      label: "Trennlinien",
      group: "Farben",
      default: "#ebebe6",
      cssVar: "--color-border",
    },
    {
      key: "colorSurfaceDark",
      type: "color",
      label: "Dunkle Fläche",
      description: "Grund des Fußbereichs und dunkler Abschnitte.",
      group: "Farben",
      default: "#0e1116",
      cssVar: "--color-surface-dark",
    },
  ],
};
