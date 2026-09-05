import type {
  TemplateField,
  TemplateFieldType,
  TemplateManifest,
} from "./template-manifest";

/**
 * Erzeugt aus den Design-Tokens einer Template-CSS einen
 * **Manifest-Entwurf** – die stumpfe Arbeit beim Anlegen eines neuen
 * Templates (Nutzerentscheidung, 2026-09-05).
 *
 * Was ableitbar ist und was nicht, ist die ganze Idee dieser Datei:
 *
 * | ableitbar | nicht ableitbar |
 * | --- | --- |
 * | Schlüssel, Feldtyp, Vorgabewert, CSS-Variable | Beschriftung, Gruppe, Grenzen, Bedingungen |
 *
 * Aus `--color-muted-foreground: #4b5058` wird deshalb ein brauchbares
 * Farbfeld mit richtigem Vorgabewert – aber die Beschriftung lautet
 * zunächst "Color muted foreground". Der Entwurf ist ein Anfang, kein
 * Ergebnis; die Bedeutung trägt ein Mensch nach.
 *
 * Bereiche kann der Entwurf gar nicht erraten: dass ein Template einen
 * Kopfbereich rendert, steht in seinem React-Code, nicht in seiner CSS.
 * Er schlägt deshalb `header`/`footer` als das übliche Paar vor.
 */

/** Ein Token aus dem `@theme`-Block: Name ohne `--`, Rohwert. */
export interface TemplateToken {
  name: string;
  value: string;
}

/**
 * Liest die Tokens aus dem ersten `@theme { … }`-Block einer CSS-Datei.
 *
 * Bewusst eine kleine, eigene Zerlegung statt eines CSS-Parsers: gesucht
 * sind ausschließlich `--name: wert;`-Zeilen der obersten Ebene. Alles
 * andere (Kommentare, verschachtelte Regeln) wird übersprungen, statt es
 * zu deuten.
 */
export function parseThemeTokens(css: string): TemplateToken[] {
  const start = css.indexOf("@theme");
  if (start === -1) return [];
  const open = css.indexOf("{", start);
  if (open === -1) return [];

  // Bis zur passenden schließenden Klammer zählen – der Block enthält
  // keine verschachtelten Regeln, aber Kommentare mit Klammern.
  let depth = 0;
  let end = -1;
  for (let i = open; i < css.length; i += 1) {
    const char = css[i];
    if (char === "{") depth += 1;
    else if (char === "}") {
      depth -= 1;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }
  if (end === -1) return [];

  const body = css
    .slice(open + 1, end)
    // Kommentare zuerst weg, sonst landen auskommentierte Tokens im
    // Entwurf.
    .replace(/\/\*[\s\S]*?\*\//g, "");

  const tokens: TemplateToken[] = [];
  for (const declaration of body.split(";")) {
    const match = /^\s*--([a-z0-9-]+)\s*:\s*([\s\S]+)$/i.exec(declaration);
    if (!match) continue;
    const value = match[2].replace(/\s+/g, " ").trim();
    if (!value) continue;
    tokens.push({ name: match[1], value });
  }
  return tokens;
}

/** Farbe, Zahl mit Einheit oder Text – abgeleitet aus dem WERT, nicht aus
 * dem Namen: `#fbfbf9` ist eine Farbe, `1180px` eine Zahl, alles andere
 * (Schrift-Stapel, `calc()`, Verläufe) bleibt Text. */
function fieldTypeFor(value: string): {
  type: TemplateFieldType;
  unit?: string;
} {
  if (/^#[0-9a-f]{3,8}$/i.test(value)) return { type: "color" };
  if (/^(rgb|hsl|oklch)a?\(/i.test(value)) return { type: "color" };
  const numeric = /^(-?\d+(?:\.\d+)?)(px|rem|em|%)$/.exec(value);
  if (numeric) return { type: "number", unit: numeric[2] };
  return { type: "text" };
}

/** `color-muted-foreground` → `colorMutedForeground` (Schlüssel) */
function toKey(name: string): string {
  return name.replace(/-([a-z0-9])/g, (_, char: string) => char.toUpperCase());
}

/** `color-muted-foreground` → `Color muted foreground` (Platzhalter-
 * Beschriftung, die nachgebessert werden will). */
function toLabel(name: string): string {
  const words = name.replace(/-/g, " ").trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** Grobe Einordnung nach Namenspräfix – spart beim Nachbessern die
 * Sortierarbeit. Bewusst nur drei Töpfe: mehr zu raten hieße, sich zu
 * verschätzen. */
function groupFor(name: string): string {
  if (name.startsWith("color")) return "Farben";
  if (name.startsWith("font")) return "Schriften";
  return "Layout";
}

export interface TemplateManifestDraft {
  manifest: TemplateManifest;
  /** Tokens, die übersprungen wurden, mit Begründung – damit niemand
   * rätselt, warum ein Wert fehlt. */
  skipped: { name: string; reason: string }[];
}

/**
 * Baut den Entwurf. `name` ist der Anzeigename des Templates.
 *
 * Übersprungen werden Tokens, deren Wert auf eine andere Variable zeigt
 * (`var(--…)`): sie sind abgeleitet, nicht eingestellt – wer sie
 * einstellbar macht, bekommt zwei Wahrheiten für denselben Wert.
 */
export function buildManifestDraft(
  css: string,
  name: string,
): TemplateManifestDraft {
  const tokens = parseThemeTokens(css);
  const settings: TemplateField[] = [];
  const skipped: { name: string; reason: string }[] = [];

  for (const token of tokens) {
    if (token.value.includes("var(")) {
      skipped.push({
        name: token.name,
        reason: "verweist auf eine andere Variable",
      });
      continue;
    }
    const { type, unit } = fieldTypeFor(token.value);
    const base = {
      key: toKey(token.name),
      label: toLabel(token.name),
      group: groupFor(token.name),
      cssVar: `--${token.name}`,
    };
    if (type === "color") {
      settings.push({ ...base, type: "color", default: token.value });
    } else if (type === "number") {
      settings.push({
        ...base,
        type: "number",
        unit,
        default: Number.parseFloat(token.value),
      });
    } else {
      settings.push({ ...base, type: "text", default: token.value });
    }
  }

  return {
    manifest: {
      name,
      regions: [
        { key: "header", label: "Kopfbereich" },
        { key: "footer", label: "Fußbereich" },
      ],
      settings,
    },
    skipped,
  };
}
