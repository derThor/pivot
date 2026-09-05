/**
 * **Der Gestaltungs-Vertrag zwischen System und Template.**
 *
 * Nutzervorgabe, 2026-09-05: *"die komponenten bleiben so. sollen aber
 * über das template im aussehen geändert werden können, wenn angegeben.
 * rein css. … das dies vom system im manifest von uns dem template
 * mitgegeben wird."*
 *
 * Die gemeinsamen Komponenten tragen neben ihren Tailwind-Utilities eine
 * **stabile Klasse** je Bauteil. Ein hochgeladenes Template stylt gegen
 * diese Klassen – und nur gegen sie. Alles andere (die Utility-Klassen im
 * Markup) ist Innenleben und darf sich jederzeit ändern.
 *
 * Warum das nötig ist: ohne festen Anker müsste fremdes CSS gegen
 * `.flex.flex-wrap.items-center.gap-x-8` schreiben. Das funktioniert genau
 * bis zum nächsten Umbau der Komponente – und bricht dann still, in einer
 * fremden Installation, ohne dass es hier jemand merkt.
 *
 * **Regeln für diese Liste:**
 * - Eine Klasse hier ist eine Zusage. Umbenennen heißt: fremde Templates
 *   brechen. Im Zweifel eine neue Klasse ergänzen statt eine umzubenennen.
 * - Eine Klasse trägt KEINE eigene Gestaltung im System – sie ist nur ein
 *   Griff. So kann ein Template sie ohne Spezifitäts-Kampf überschreiben.
 * - Die Liste wird dem Template mitgegeben (Manifest-Entwurf und
 *   Oberfläche), damit niemand raten muss.
 */

export interface StyleHook {
  /** Die Klasse im Markup, ohne Punkt. */
  className: string;
  /** Was man damit gestaltet – in der Oberfläche sichtbar. */
  label: string;
  /** Wo sie sitzt und was zu beachten ist. */
  description?: string;
}

export const STYLE_HOOKS: StyleHook[] = [
  {
    className: "pv-header",
    label: "Kopfbereich",
    description:
      "Der Balken über jeder Seite. Klebt und zeichnet weich, solange die Einstellungen es sagen – Position und Verhalten gehören dem System, Fläche und Rahmen dem Template.",
  },
  {
    className: "pv-header-inner",
    label: "Kopfbereich, Inhaltsbahn",
    description: "Die begrenzte Bahn innerhalb des Kopfbalkens.",
  },
  {
    className: "pv-main",
    label: "Inhaltsbereich",
    description:
      "Die Bahn, in der die Seiteninhalte stehen. Ihre Breite kommt aus --content-width.",
  },
  {
    className: "pv-footer",
    label: "Fußbereich",
  },
  {
    className: "pv-nav",
    label: "Menüleiste",
    description: "Umschließt die Menüpunkte (im Kopfbereich und im Baustein).",
  },
  {
    className: "pv-nav-link",
    label: "Menüpunkt (Link)",
  },
  {
    className: "pv-nav-button",
    label: "Menüpunkt (Knopf)",
    description:
      "Menüpunkte mit der Darstellung „Textknopf“ oder „Akzentknopf“.",
  },
  {
    className: "pv-block",
    label: "Baustein (alle)",
    description:
      "Sitzt an jedem Baustein – der Griff für alles, was für sämtliche Bausteine gelten soll.",
  },
  {
    className: "pv-block-spacing",
    label: "Baustein-Abstände",
    description:
      "Der innere Rahmen, der die im Designer gesetzten Abstände trägt. Wer hier Abstände setzt, überschreibt die Redaktion – meist unerwünscht.",
  },
  {
    className: "pv-region",
    label: "Bereich (Kopf/Fuß aus Bausteinen)",
  },
  {
    className: "pv-article",
    label: "Seiteninhalt",
    description: "Umschließt Titel, Anreißtext und die Bausteine einer Seite.",
  },
  {
    className: "pv-archive",
    label: "Kategorie-Übersicht",
  },
  {
    className: "pv-post",
    label: "Beitrag in der Blog-Darstellung",
  },
  {
    className: "pv-form",
    label: "Formular",
  },
];

/** Die Liste als Kommentarblock für eine Template-CSS – kommt im
 * Manifest-Entwurf mit, damit der Autor sie direkt vor sich hat.
 * `moduleTypes` ergänzt die Baustein-Klassen (siehe blockStyleHooks). */
export function styleHookReference(
  moduleTypes: { slug: string; name: string }[] = [],
): string {
  return [
    "/* Ankerklassen dieses Systems – daran darf ein Template andocken.",
    "   Alles andere im Markup ist Innenleben und kann sich ändern.",
    "",
    ...allStyleHooks(moduleTypes).map(
      (hook) =>
        `   .${hook.className}${" ".repeat(Math.max(1, 22 - hook.className.length))}${hook.label}`,
    ),
    "*/",
  ].join("\n");
}

/**
 * Die Klassen der BAUSTEINE – nicht gepflegt, sondern abgeleitet
 * (Nutzerhinweis, 2026-09-05: *"das system kennt seine komponenten ja"*).
 *
 * Jeder Baustein trägt im Markup `pv-block` plus `pv-block-<slug>`. Der
 * Katalog dazu entsteht aus den Modul-Typen der Datenbank – kommt ein
 * Baustein hinzu, steht seine Klasse sofort in der Liste, ohne dass
 * jemand hier etwas nachträgt.
 *
 * Für die HÜLLE (Kopfbereich, Bahn, Fußbereich …) geht das nicht: die gibt
 * es nur als Code, und der ist selbst die Definition. Deshalb steht sie
 * oben als Liste – aber als EINE Liste, die zugleich das Markup versorgt
 * und die Dokumentation speist, damit beides nicht auseinanderläuft.
 */
export function blockStyleHooks(
  moduleTypes: { slug: string; name: string }[],
): StyleHook[] {
  return moduleTypes.map((moduleType) => ({
    className: blockHookClass(moduleType.slug),
    label: `Baustein „${moduleType.name}“`,
  }));
}

/** `cover` → `pv-block-cover`. Der Slug ist stabil (er steht im Seed und
 * wird von Inhalten referenziert), taugt also als Klassenname. */
export function blockHookClass(slug: string): string {
  return `pv-block-${slug.replace(/[^a-z0-9-]/gi, "-").toLowerCase()}`;
}

/** Hülle + Bausteine zusammen – das, was ein Template ansprechen darf. */
export function allStyleHooks(
  moduleTypes: { slug: string; name: string }[],
): StyleHook[] {
  return [...STYLE_HOOKS, ...blockStyleHooks(moduleTypes)];
}
