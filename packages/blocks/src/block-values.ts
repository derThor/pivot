import type {
  BlockLayoutValue,
  ContentTypeField,
  GlobalModule,
  ImageAlign,
  ImageFieldValue,
  RepeaterItem,
  ResponsiveSpacing,
  SpacingSide,
  VideoFieldValue,
} from "./types";
import { SPACING_SIDES } from "./types";
import { cn } from "./cn";

// Löst eine Modul-Instanz auf ihren *effektiven* Modul-Typ + Werte auf:
// bei einer normalen Instanz unverändert die eigenen Werte, bei einer
// Referenz auf ein globales Modul (`globalModuleId` gesetzt) live die
// aktuellen Werte des referenzierten `GlobalModule` – kein Snapshot, jede
// Änderung am globalen Modul wirkt sich dadurch sofort überall aus, wo es
// eingebunden ist.
export function resolveInstanceValues(
  instance: {
    moduleTypeId: string;
    values: Record<string, unknown>;
    globalModuleId?: string;
  },
  globalModules: GlobalModule[],
): {
  moduleTypeId: string;
  values: Record<string, unknown>;
  settings?: Record<string, unknown> | null;
} {
  if (!instance.globalModuleId) {
    return { moduleTypeId: instance.moduleTypeId, values: instance.values };
  }
  const globalModule = globalModules.find(
    (g) => g.id === instance.globalModuleId,
  );
  if (!globalModule) {
    return { moduleTypeId: instance.moduleTypeId, values: {} };
  }
  return {
    moduleTypeId: globalModule.moduleTypeId,
    values: globalModule.values,
    settings: globalModule.settings,
  };
}

export function toRepeaterItems(raw: unknown): RepeaterItem[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((entry) => {
    if (!entry || typeof entry !== "object") return [];
    const obj = entry as Record<string, unknown>;
    if (typeof obj.id !== "string") return [];
    const values =
      obj.values && typeof obj.values === "object"
        ? (obj.values as Record<string, unknown>)
        : {};
    return [{ id: obj.id, values }];
  });
}

// Bild-Felder wurden ursprünglich als reiner URL-String gespeichert –
// ältere/einfache Werte bleiben dadurch abwärtskompatibel lesbar.
export function toImageValue(raw: unknown): ImageFieldValue {
  if (typeof raw === "string") return { url: raw };
  if (
    raw &&
    typeof raw === "object" &&
    "url" in (raw as Record<string, unknown>)
  ) {
    const obj = raw as Record<string, unknown>;
    const align = obj.align;
    return {
      url: typeof obj.url === "string" ? obj.url : "",
      width: typeof obj.width === "number" ? obj.width : undefined,
      // Whitelist statt Durchreichen: ein unbekannter Wert aus alten
      // Daten soll nicht als CSS-Klasse landen. Beim Ergaenzen einer
      // Ausrichtung MUSS sie hier mit aufgenommen werden – "bleed" fehlte
      // zunaechst und wurde still zu "none" (Nutzer-Bugreport,
      // 2026-09-03: "volle fensterbreite gestellt, nichts hat sich
      // veraendert").
      align:
        align === "full" ||
        align === "bleed" ||
        align === "left" ||
        align === "center" ||
        align === "right"
          ? align
          : "none",
      // Wie bei `align`: Whitelist, damit kein Fremdwert als CSS-Klasse
      // landet. Eine neue Variante MUSS hier mit aufgenommen werden.
      fit:
        obj.fit === "cover" || obj.fit === "contain" || obj.fit === "fill"
          ? obj.fit
          : undefined,
      mediaId: typeof obj.mediaId === "string" ? obj.mediaId : undefined,
      variants: Array.isArray(obj.variants)
        ? (obj.variants as ImageFieldValue["variants"])
        : undefined,
      thumbnailUrl:
        typeof obj.thumbnailUrl === "string" ? obj.thumbnailUrl : undefined,
      focalX: typeof obj.focalX === "number" ? obj.focalX : undefined,
      focalY: typeof obj.focalY === "number" ? obj.focalY : undefined,
    };
  }
  return { url: "" };
}

// CSS `object-position`-Wert aus dem Fokuspunkt, oder `undefined`
// (= Browser-Default Bildmitte), wenn keiner gesetzt ist.
export function focalObjectPosition(
  img: Pick<ImageFieldValue, "focalX" | "focalY">,
): string | undefined {
  if (img.focalX == null || img.focalY == null) return undefined;
  return `${img.focalX * 100}% ${img.focalY * 100}%`;
}

export function toVideoValue(raw: unknown): VideoFieldValue {
  if (typeof raw === "string") return { url: raw };
  if (
    raw &&
    typeof raw === "object" &&
    "url" in (raw as Record<string, unknown>)
  ) {
    const obj = raw as Record<string, unknown>;
    return {
      url: typeof obj.url === "string" ? obj.url : "",
      mediaId: typeof obj.mediaId === "string" ? obj.mediaId : undefined,
    };
  }
  return { url: "" };
}

const YOUTUBE_URL_RE =
  /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{6,})/;
const VIMEO_URL_RE = /vimeo\.com\/(?:video\/)?(\d+)/;

/** Erkennt YouTube-/Vimeo-Links und liefert die passende iframe-Embed-URL –
 * für eigene, per Medienbibliothek hochgeladene Videodateien (mp4/webm/…)
 * `null`, die werden stattdessen direkt per `<video>` abgespielt. */
export function videoEmbedSrc(url: string): string | null {
  const youtube = url.match(YOUTUBE_URL_RE);
  if (youtube) return `https://www.youtube-nocookie.com/embed/${youtube[1]}`;
  const vimeo = url.match(VIMEO_URL_RE);
  if (vimeo) return `https://player.vimeo.com/video/${vimeo[1]}`;
  return null;
}

export function spacingStyleVars(
  value: ResponsiveSpacing | undefined,
  kind: "padding" | "margin",
): Record<string, string> {
  const vars: Record<string, string> = {};
  for (const breakpoint of ["mobile", "tablet", "desktop"] as const) {
    const box = value?.[breakpoint];
    if (!box) continue;
    for (const side of SPACING_SIDES) {
      const sideValue = box[side as SpacingSide];
      if (sideValue != null) {
        vars[`--block-${kind}-${side}-${breakpoint}`] = `${sideValue}px`;
      }
    }
  }
  return vars;
}

// "Keine Ausrichtung" (align "none") wird von `blockLayoutClasses` NICHT
// als Float gerendert – bei voller Breite (100%) ist das korrekt. Wurde
// die Breite aber per Zieh-Griff unter 100% reduziert, ohne dass explizit
// links/rechts/zentriert gewählt wurde, heilt das automatisch zu "links",
// sowohl für neu gezogene als auch für bereits gespeicherte Alt-Zustände.
function healAlign(align: ImageAlign, width: number): ImageAlign {
  return align === "none" && width < 100 ? "left" : align;
}

export function resolveBlockLayout(
  contentFields: ContentTypeField[],
  values: Record<string, unknown>,
  layout: BlockLayoutValue | undefined,
): { align: ImageAlign; width: number; hasIntraBlockImage: boolean } {
  const imageFields = contentFields.filter((f) => f.type === "image");
  if (imageFields.length > 0 && contentFields.length > 1) {
    // Blockinternes Bild: das Bild richtet sich INNERHALB des Blocks aus
    // (Float neben Text, Kachel-Raster, Cover-Hintergrund) – dafür steht
    // `hasIntraBlockImage`.
    //
    // Der Block selbst bekommt seit 2026-09-03 trotzdem seine eigene
    // Ausrichtung aus `layout` (Nutzervorgabe: "auf jeden Block soll die
    // Ausrichtung gesetzt werden, so dass ich überall Vollbild usw.
    // anwenden kann"). Vorher stand hier fest `none`/100 – Cover und
    // Kacheln konnten dadurch überhaupt nicht ausgerichtet werden.
    //
    // Rückwärtskompatibel: bestehende Blöcke haben kein `layout`, das
    // ergibt weiterhin `none`/100.
    const align = layout?.align ?? "none";
    const width = align === "full" ? 100 : (layout?.width ?? 100);
    return { align: healAlign(align, width), width, hasIntraBlockImage: true };
  }
  if (imageFields.length === 1) {
    const img = toImageValue(values[imageFields[0].name]);
    const align = img.align ?? "none";
    const width = align === "full" ? 100 : (img.width ?? 100);
    return { align: healAlign(align, width), width, hasIntraBlockImage: false };
  }
  const align = layout?.align ?? "none";
  const width = align === "full" ? 100 : (layout?.width ?? 100);
  return { align: healAlign(align, width), width, hasIntraBlockImage: false };
}

// Inline-Breite eines Block-Wrappers – gehört zwingend zu
// `blockLayoutClasses()` und darf nicht von Hand danebengesetzt werden.
//
// Grund (Nutzer-Bugreport, 2026-09-03: "volle fensterbreite gestellt,
// nichts hat sich verändert"): "Randlos" setzt die Breite über die Klasse
// `w-screen`. Eine Inline-Angabe `width: 100%` schlägt jede Klasse – der
// Block blieb dadurch in der Inhaltsbahn stehen, obwohl die Ausrichtung
// korrekt gespeichert und ausgewertet war. Bei `bleed` darf hier also
// KEINE Breite stehen.
export function blockLayoutStyle(
  align: ImageAlign,
  width: number = 100,
): { width: string } | undefined {
  if (align === "bleed") return undefined;
  return { width: `${width}%` };
}

// Erkennt Module mit mehreren Bild-Feldern (z.B. den "Kacheln"-Baustein)
// generisch über die Feldanzahl, nicht über den Modul-Slug.
export function isTilesModule(contentFields: ContentTypeField[]): boolean {
  return contentFields.filter((f) => f.type === "image").length > 1;
}

/** Slug des Bausteins, der in der Blog-Darstellung den Anriss beendet.
 * Er hat wie der Trenner KEINE Felder – ohne diese Unterscheidung würde
 * `isDividerModule()` ihn als Trennlinie rendern (Nutzervorgabe,
 * 2026-09-03). */
export const READ_MORE_SLUG = "read-more";

export function isReadMoreModule(slug: string | undefined): boolean {
  return slug === READ_MORE_SLUG;
}

// Erkennt Module ohne jegliches sichtbares Feld (der "Trenner"-Baustein).
export function isDividerModule(contentFields: ContentTypeField[]): boolean {
  return contentFields.length === 0;
}

// Erkennt Module mit variabler Eintragsanzahl (Akkordeon/FAQ, Galerie)
// über den Feldtyp "repeater".
export function isComplexModuleType(
  contentFields: ContentTypeField[],
): boolean {
  return contentFields.some((f) => f.type === "repeater");
}

// Unterscheidet die beiden aktuell einzigen komplexen Modul-Typen wieder
// über die Form statt über Name/Slug: Galerie hat ein Bild-Unterfeld im
// Repeater, FAQ/Akkordeon nicht.
export function isGalleryModuleType(
  contentFields: ContentTypeField[],
): boolean {
  if (!isComplexModuleType(contentFields)) return false;
  const repeaterField = contentFields.find((f) => f.type === "repeater");
  return repeaterField?.fields?.some((f) => f.type === "image") ?? false;
}

export function isFaqModuleType(contentFields: ContentTypeField[]): boolean {
  return (
    isComplexModuleType(contentFields) && !isGalleryModuleType(contentFields)
  );
}

// Erkennt den Cover-/Hero-Baustein über sein Bild-Feld mit
// `variant: "cover"`.
export function isCoverModuleType(contentFields: ContentTypeField[]): boolean {
  return contentFields.some((f) => f.type === "image" && f.variant === "cover");
}

// Formular-Baustein – Form-Erkennung statt Slug-Abfrage, wie bei allen
// anderen Bausteinen hier.
export function isFormModuleType(contentFields: ContentTypeField[]): boolean {
  return contentFields.some((f) => f.type === "form");
}

// Erkennt Repeater-Felder, deren Unterfelder ein Bild enthalten (die
// "Bildergalerie"). Ein Repeater ohne Bild-Unterfeld (z.B. FAQ) wird
// stattdessen als Akkordeon gerendert (siehe block-field-output.tsx).
export function isGalleryRepeater(field: ContentTypeField): boolean {
  return (
    field.type === "repeater" &&
    (field.fields ?? []).some((f) => f.type === "image")
  );
}

// Gemeinsame Positionierungs-Klassen für einen Block-Wrapper: echtes
// Float bei links/rechts, `clear-both` sonst. `width` bewusst mit
// einbezogen: bei 100% Breite ergäbe `mr-4`/`ml-4` zusätzlich zur vollen
// Breite eine Gesamtbreite von 100% + 16px – der Block würde seinen
// Elternrahmen überlaufen (Pivot-Vorgabe: nie horizontal scrollbar).
export function blockLayoutClasses(align: ImageAlign, width: number = 100) {
  const hasHorizontalMargin = width < 100;
  return cn(
    align === "left" && cn("float-left mb-3", hasHorizontalMargin && "mr-4"),
    align === "right" && cn("float-right mb-3", hasHorizontalMargin && "ml-4"),
    align === "center" && "mx-auto clear-both",
    (align === "none" || align === "full") && "clear-both",
    // Randlos: der Block bricht aus der zentrierten Inhaltsbahn aus und
    // nimmt die volle Fensterbreite ein. `50% - 50vw` ist der Abstand von
    // der linken Bahnkante zum Fensterrand – dieselbe Rechnung rechts.
    //
    // Bewusst NICHT über eine Umstellung der Bahn selbst gelöst (Container
    // aus dem Layout in jeden Baustein verschieben): das hätte jede Seite
    // und jede Liste angefasst, für eine Eigenschaft, die einzelne Blöcke
    // brauchen.
    //
    // `100vw` schließt die Bildlaufleiste mit ein, der Block ragt also um
    // deren Breite über den sichtbaren Bereich hinaus. Deshalb MUSS ein
    // Vorfahr horizontal abschneiden – in apps/site tut das `<main>`
    // (overflow-x-clip). Ohne das entstünde eine waagerechte
    // Bildlaufleiste, und die soll es hier nie geben.
    align === "bleed" &&
      "clear-both w-screen max-w-none ml-[calc(50%-50vw)] mr-[calc(50%-50vw)]",
  );
}
