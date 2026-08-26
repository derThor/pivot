// Leitet aus einer beliebigen Hex-Akzentfarbe (Settings → Darstellung →
// "Akzentfarbe") das komplette Set an CSS-Custom-Properties ab, die in
// globals.css bisher fest auf den Lime-Markenton (Hue 122) verdrahtet sind.
// Prinzip: nur der FARBTON (Hue) der gewählten Farbe wird übernommen,
// Helligkeit/Sättigung folgen exakt derselben "Form" wie die bestehende
// Lime-Palette (dieselben L/C-Werte je Token, nur mit neuem Hue) – so
// bleibt Kontrast/Lesbarkeit für jede gewählte Farbe garantiert, ohne für
// jede mögliche Farbe eine eigene, von Hand abgestimmte Palette zu
// brauchen. Ausnahme: deutlich dunkle Eingabefarben (z.B. Navy) würden mit
// dieser "immer hell"-Form wie ein blasses Pastell wirken statt wie ein
// dunkler Button – für sie greift ein zweiter Ast, der die tatsächliche
// (dunkle) Helligkeit der Eingabe für `--primary` übernimmt und die
// Vordergrundfarbe entsprechend auf Hell dreht.

function srgbToLinear(channel: number): number {
  const c = channel / 255;
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

/** sRGB-Hex → OKLCH (L 0..1, C, H in Grad). Standard-Björn-Ottosson-Matrizen
 * (https://bottosson.github.io/posts/oklab/), dieselbe Formel, auf der
 * CSS Color 4 `oklch()` beruht. */
function hexToOklch(hex: string): { l: number; c: number; h: number } {
  const r = srgbToLinear(parseInt(hex.slice(1, 3), 16));
  const g = srgbToLinear(parseInt(hex.slice(3, 5), 16));
  const b = srgbToLinear(parseInt(hex.slice(5, 7), 16));

  const lC = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b;
  const mC = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b;
  const sC = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b;

  const l_ = Math.cbrt(lC);
  const m_ = Math.cbrt(mC);
  const s_ = Math.cbrt(sC);

  const l = 0.2104542553 * l_ + 0.793617785 * m_ - 0.0040720468 * s_;
  const a = 1.9779984951 * l_ - 2.428592205 * m_ + 0.4505937099 * s_;
  const bb = 0.0259040371 * l_ + 0.7827717662 * m_ - 0.808675766 * s_;

  const c = Math.sqrt(a * a + bb * bb);
  let h = (Math.atan2(bb, a) * 180) / Math.PI;
  if (h < 0) h += 360;

  return { l, c, h };
}

function ok(l: number, c: number, h: number, alpha?: number) {
  const value = `oklch(${l} ${c} ${h})`;
  return alpha == null ? value : `oklch(${l} ${c} ${h} / ${alpha})`;
}

export interface AccentTokens {
  primary: string;
  primaryForeground: string;
  accent: string;
  accentForeground: string;
  ring: string;
  chart1: string;
  sidebarPrimary: string;
  sidebarPrimaryForeground: string;
  sidebarAccent: string;
  sidebarAccentForeground: string;
  sidebarRing: string;
}

const DARK_INPUT_LIGHTNESS_THRESHOLD = 0.5;

function deriveForMode(hex: string, variant: "light" | "dark"): AccentTokens {
  const { l, c, h } = hexToOklch(hex);

  if (l < DARK_INPUT_LIGHTNESS_THRESHOLD) {
    // Dunkle Eingabefarbe (z.B. Navy): --primary übernimmt die tatsächliche
    // Helligkeit der Auswahl (wirkt dann wirklich dunkel), Vordergrund auf
    // Hell gedreht. Restliche Tokens folgen der Standard-Lime-"Form".
    return {
      primary: ok(l, Math.min(c, 0.08), h),
      primaryForeground: ok(0.97, 0.005, 90),
      accent: ok(
        variant === "light" ? 0.94 : 0.32,
        variant === "light" ? 0.08 : 0.06,
        h,
      ),
      accentForeground: ok(
        variant === "light" ? 0.35 : 0.88,
        variant === "light" ? 0.1 : 0.1,
        h,
      ),
      ring: ok(variant === "light" ? 0.68 : 0.75, 0.18, h, 0.5),
      chart1: ok(l, Math.min(c, 0.08), h),
      sidebarPrimary: ok(l, Math.min(c, 0.08), h),
      sidebarPrimaryForeground: ok(0.97, 0.005, 90),
      sidebarAccent: ok(
        variant === "light" ? 0.94 : 0.3,
        variant === "light" ? 0.06 : 0.05,
        h,
      ),
      sidebarAccentForeground: ok(
        variant === "light" ? 0.3 : 0.85,
        variant === "light" ? 0.08 : 0.08,
        h,
      ),
      sidebarRing: ok(variant === "light" ? 0.68 : 0.75, 0.18, h, 0.5),
    };
  }

  // Helle/vivide Eingabefarbe: exakt dieselbe L/C-"Form" wie die
  // bestehende Lime-Palette in globals.css, nur mit dem neuen Hue.
  if (variant === "light") {
    return {
      primary: ok(0.89, 0.19, h),
      primaryForeground: ok(0.16, 0, 0),
      accent: ok(0.94, 0.08, h),
      accentForeground: ok(0.35, 0.1, h),
      ring: ok(0.68, 0.18, h, 0.5),
      chart1: ok(0.89, 0.19, h),
      sidebarPrimary: ok(0.89, 0.19, h),
      sidebarPrimaryForeground: ok(0.16, 0, 0),
      sidebarAccent: ok(0.94, 0.06, h),
      sidebarAccentForeground: ok(0.3, 0.08, h),
      sidebarRing: ok(0.68, 0.18, h, 0.5),
    };
  }
  return {
    primary: ok(0.85, 0.19, h),
    primaryForeground: ok(0.16, 0, 0),
    accent: ok(0.32, 0.06, h),
    accentForeground: ok(0.88, 0.1, h),
    ring: ok(0.75, 0.18, h, 0.5),
    chart1: ok(0.89, 0.19, h),
    sidebarPrimary: ok(0.85, 0.19, h),
    sidebarPrimaryForeground: ok(0.16, 0, 0),
    sidebarAccent: ok(0.3, 0.05, h),
    sidebarAccentForeground: ok(0.85, 0.08, h),
    sidebarRing: ok(0.75, 0.18, h, 0.5),
  };
}

function tokensToCss(tokens: AccentTokens): string {
  return [
    `--primary: ${tokens.primary};`,
    `--primary-foreground: ${tokens.primaryForeground};`,
    `--accent: ${tokens.accent};`,
    `--accent-foreground: ${tokens.accentForeground};`,
    `--ring: ${tokens.ring};`,
    `--chart-1: ${tokens.chart1};`,
    `--sidebar-primary: ${tokens.sidebarPrimary};`,
    `--sidebar-primary-foreground: ${tokens.sidebarPrimaryForeground};`,
    `--sidebar-accent: ${tokens.sidebarAccent};`,
    `--sidebar-accent-foreground: ${tokens.sidebarAccentForeground};`,
    `--sidebar-ring: ${tokens.sidebarRing};`,
  ].join(" ");
}

/** CSS-Text für ein `<style>`-Tag, das die Akzentfarbe global auf `:root`
 * überschreibt (siehe dashboard/layout.tsx). Bewusst NICHT auf einen
 * bestimmten Wrapper-Knoten gescoped (ursprünglich `#accent-scope`) – Base-
 * UI-Portale (Dropdown-Menüs, Tooltips, Dialoge) rendern ihren Inhalt direkt
 * in `document.body`, außerhalb jedes DOM-Wrappers innerhalb des Dashboard-
 * Layouts. Da dieses `<style>`-Tag ohnehin nur eingebunden ist, während das
 * Dashboard-Layout gemountet ist, wirkt `:root` faktisch genauso begrenzt
 * wie ein Scope-Selektor, erreicht aber zusätzlich jedes Portal. */
export function buildAccentColorCss(hex: string) {
  const light = tokensToCss(deriveForMode(hex, "light"));
  const dark = tokensToCss(deriveForMode(hex, "dark"));
  return `:root { ${light} } :root.dark { ${dark} }`;
}
