/**
 * Das Vertragsformat zwischen einem Frontend-Template und der Verwaltung.
 *
 * Hintergrund (Nutzerentscheidung, 2026-09-05): *"ich möchte eine komplett
 * individuelle mechanik … ich möchte nichts starres bauen, das nur für
 * pivot geht. beim frontend muss das für jedes template, egal wie es
 * aussieht, gehen."*
 *
 * Die Lösung ist dasselbe Muster, das der Seiten-Designer schon benutzt:
 * er kennt keinen einzigen Baustein namentlich, sondern liest
 * `ModuleType.schema` und rendert daraus generisch ein Formular. Genauso
 * kennt die Verwaltung kein Template namentlich – sie liest dessen
 * **Manifest** und baut daraus die Oberfläche unter Einstellungen →
 * Frontend.
 *
 * Das Manifest liegt beim Template selbst
 * (`apps/site/src/template/manifest.ts`, projekteigen wie `brand.ts`) und
 * wird mit ihm versioniert – es kann also nie auseinanderlaufen. Die
 * Website gibt es unter `GET /api/template` als JSON aus, die Verwaltung
 * holt es sich von dort.
 *
 * **Was hier bewusst starr ist:** die Liste der Feldtypen unten. Die
 * Verwaltung muss wissen, wie sie ein Feld zeichnet – das ist der einzige
 * gemeinsame Nenner. Sie ist nicht Pivot-spezifisch, sondern das
 * Vokabular, in dem sich alle Templates ausdrücken. Ein Template, das
 * mehr braucht, erweitert das Vokabular für alle (eine bewusste
 * Entscheidung), statt einen Sonderfall zu bekommen.
 */

/** Wie die Verwaltung ein Feld zeichnet. */
export type TemplateFieldType =
  | "text"
  | "textarea"
  | "number"
  | "color"
  | "select"
  | "boolean"
  /** Bild aus der Medienbibliothek (gespeichert wird die URL). */
  | "image"
  /** Auswahl eines vorhandenen Menüs (gespeichert wird dessen Id). */
  | "navigation"
  /** Der dreistufige Abstandsblock (Mobil/Tablet/Desktop, oben/unten). */
  | "spacing";

/** Wert eines Feldes. `spacing` speichert ein Objekt, alles andere einen
 * Skalar; `null` heißt durchgängig "nicht gesetzt, nimm die Vorgabe". */
export type TemplateSettingValue =
  string | number | boolean | TemplateSpacingValue | null;

export interface TemplateSpacingValue {
  topMobile?: number | null;
  bottomMobile?: number | null;
  topTablet?: number | null;
  bottomTablet?: number | null;
  topDesktop?: number | null;
  bottomDesktop?: number | null;
}

interface TemplateFieldBase {
  /** Schlüssel im Wertespeicher. Stabil halten – er ist der Name, unter
   * dem der Wert in der Datenbank liegt. */
  key: string;
  label: string;
  /** Erklärung unter dem Feld. */
  description?: string;
  /** Überschrift, unter der das Feld in der Oberfläche einsortiert wird
   * (z.B. "Farben", "Layout"). Felder ohne Gruppe stehen oben. */
  group?: string;
  /**
   * CSS-Variable, die die Website aus dem Wert setzt (z.B.
   * `--content-width`). Damit braucht das Template für den Normalfall
   * keinen eigenen Code: es benutzt seine Variablen wie bisher, und der
   * Wert kommt jetzt aus den Einstellungen statt aus der Datei.
   *
   * Ohne Angabe liest das Template den Wert selbst aus (siehe
   * `templateSettings` in der Antwort von `/public/site`) – nötig für
   * alles, was keine Farbe/Größe ist, etwa ein Schalter, der eine Klasse
   * umlegt.
   */
  cssVar?: string;
  /**
   * Zeigt das Feld nur, wenn andere Felder bestimmte Werte haben
   * (`{ headerStyle: "blur" }` oder `{ headerStyle: ["blur", "solid"] }`).
   * Ein ausgeblendetes Feld behält seinen Wert – es ist nur nicht
   * sichtbar, nicht gelöscht.
   */
  showIf?: Record<
    string,
    string | number | boolean | (string | number | boolean)[]
  >;
}

export interface TemplateTextField extends TemplateFieldBase {
  type: "text" | "textarea";
  default?: string | null;
  placeholder?: string;
}

export interface TemplateNumberField extends TemplateFieldBase {
  type: "number";
  default?: number | null;
  min?: number;
  max?: number;
  /** Wird hinter dem Feld angezeigt und an den CSS-Wert angehängt. */
  unit?: string;
}

export interface TemplateColorField extends TemplateFieldBase {
  type: "color";
  default?: string | null;
}

export interface TemplateSelectField extends TemplateFieldBase {
  type: "select";
  /** `[wert, beschriftung]` – als Paar statt als Objekt, damit ein
   * Manifest kurz bleibt. */
  options: [string, string][];
  default?: string | null;
}

export interface TemplateBooleanField extends TemplateFieldBase {
  type: "boolean";
  default?: boolean;
}

export interface TemplateImageField extends TemplateFieldBase {
  type: "image";
  default?: string | null;
}

export interface TemplateNavigationField extends TemplateFieldBase {
  type: "navigation";
  default?: string | null;
}

export interface TemplateSpacingField extends TemplateFieldBase {
  type: "spacing";
  default?: TemplateSpacingValue | null;
}

export type TemplateField =
  | TemplateTextField
  | TemplateNumberField
  | TemplateColorField
  | TemplateSelectField
  | TemplateBooleanField
  | TemplateImageField
  | TemplateNavigationField
  | TemplateSpacingField;

/**
 * Ein Bereich, den das Template rendert und der mit Bausteinen gefüllt
 * wird (Kopfbereich, Fußbereich, Aktionsband, Seitenleiste …).
 *
 * WELCHE Bereiche es gibt, bestimmt das Template (Nutzerentscheidung,
 * 2026-09-05) – es muss sie ja an einer Stelle ausgeben, und einen
 * unbekannten Bereich könnte es nirgends einhängen. WAS darin steht,
 * bestimmt die Redaktion im Designer.
 */
export interface TemplateRegion {
  /** Stabiler Schlüssel, unter dem das Template den Bereich abruft. */
  key: string;
  label: string;
  description?: string;
  /**
   * Bausteine, ohne die der Bereich nicht sinnvoll ist (Slugs von
   * Modul-Typen, z.B. `["logo"]` im Kopfbereich). Die Verwaltung warnt,
   * wenn einer fehlt – sie verbietet es nicht: ein Kopfbereich ohne Logo
   * kann eine bewusste Gestaltung sein.
   */
  required?: string[];
  /**
   * Erlaubte Bausteine. Ohne Angabe ist alles erlaubt. Gedacht für
   * Bereiche, in denen ein Vollbild-Cover schlicht keinen Sinn ergibt.
   */
  allow?: string[];
}

export interface TemplateManifest {
  /** Anzeigename, erscheint in der Verwaltung ("Template: Pivot"). */
  name: string;
  /** Frei wählbar, nur zur Anzeige – keine Migrationslogik daran hängen. */
  version?: string;
  regions: TemplateRegion[];
  settings: TemplateField[];
}

/** Gespeicherte Werte, Schlüssel = `TemplateField.key`. */
export type TemplateSettingsValues = Record<string, TemplateSettingValue>;

/** Vorgabewert eines Feldes – `null`, wenn das Manifest keinen nennt. */
export function templateFieldDefault(
  field: TemplateField,
): TemplateSettingValue {
  if (field.type === "boolean") return field.default ?? false;
  return field.default ?? null;
}

/**
 * Gespeicherte Werte über die Vorgaben des Manifests gelegt.
 *
 * Unbekannte Schlüssel im Speicher werden bewusst ignoriert statt
 * gelöscht: ein Template kann ein Feld vorübergehend entfernen (oder man
 * schaltet zwischen zwei Templates hin und her), und der Wert soll dann
 * nicht verloren sein.
 */
export function resolveTemplateSettings(
  manifest: TemplateManifest | null,
  stored: TemplateSettingsValues | null | undefined,
): TemplateSettingsValues {
  if (!manifest) return {};
  const values: TemplateSettingsValues = {};
  for (const field of manifest.settings) {
    const value = stored?.[field.key];
    values[field.key] =
      value === undefined ? templateFieldDefault(field) : value;
  }
  return values;
}

/**
 * Ob ein Feld nach seiner `showIf`-Bedingung sichtbar ist. Ohne Bedingung
 * immer sichtbar; mehrere Bedingungen müssen alle zutreffen.
 */
export function isTemplateFieldVisible(
  field: TemplateField,
  values: TemplateSettingsValues,
): boolean {
  if (!field.showIf) return true;
  return Object.entries(field.showIf).every(([key, expected]) => {
    const actual = values[key];
    return Array.isArray(expected)
      ? expected.some((candidate) => candidate === actual)
      : expected === actual;
  });
}

/**
 * Die CSS-Variablen, die die Website aus den Werten setzt – nur für
 * Felder mit `cssVar` und nur, wenn ein Wert vorliegt. Zahlen bekommen
 * ihre Einheit angehängt, Schalter werden zu `1`/`0` (so lassen sie sich
 * in CSS über `var()` in Berechnungen benutzen).
 *
 * `spacing` bleibt außen vor: dafür gibt es die Klasse `.page-spacing`
 * mit ihren drei Stufen, ein einzelner Variablenname reicht dort nicht.
 */
export function templateCssVars(
  manifest: TemplateManifest | null,
  values: TemplateSettingsValues,
): Record<string, string> {
  if (!manifest) return {};
  const vars: Record<string, string> = {};
  for (const field of manifest.settings) {
    if (!field.cssVar || field.type === "spacing") continue;
    const value = values[field.key];
    if (value === null || value === undefined || value === "") continue;
    if (typeof value === "object") continue;
    if (field.type === "number") {
      vars[field.cssVar] = `${String(value)}${field.unit ?? ""}`;
    } else if (typeof value === "boolean") {
      vars[field.cssVar] = value ? "1" : "0";
    } else {
      vars[field.cssVar] = String(value);
    }
  }
  return vars;
}

/** Ergebnis einer Manifest-Prüfung: leer = in Ordnung. */
export interface TemplateManifestIssue {
  path: string;
  message: string;
}

const FIELD_TYPES: TemplateFieldType[] = [
  "text",
  "textarea",
  "number",
  "color",
  "select",
  "boolean",
  "image",
  "navigation",
  "spacing",
];

/**
 * Prüft ein von außen gekommenes Manifest gegen das Vokabular – gedacht
 * für den Upload in der Verwaltung (2026-09-05).
 *
 * Bewusst NICHT geprüft wird, ob das Template die genannten CSS-Variablen
 * überhaupt benutzt oder die Bereiche rendert: das weiß nur das Template
 * selbst. Ein Feld auf eine unbenutzte Variable zeigen zu lassen ist
 * folgenlos, nicht falsch – deshalb ist das eine Sache für den Hinweistext
 * in der Oberfläche, nicht für eine Fehlermeldung.
 */
export function validateTemplateManifest(
  value: unknown,
): TemplateManifestIssue[] {
  const issues: TemplateManifestIssue[] = [];
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return [{ path: "", message: "Das Manifest muss ein Objekt sein." }];
  }
  const manifest = value as Partial<TemplateManifest>;
  if (typeof manifest.name !== "string" || !manifest.name.trim()) {
    issues.push({ path: "name", message: "Name fehlt." });
  }
  if (!Array.isArray(manifest.regions)) {
    issues.push({ path: "regions", message: "regions muss eine Liste sein." });
  } else {
    const seen = new Set<string>();
    manifest.regions.forEach((region, index) => {
      const at = `regions[${index}]`;
      if (!region || typeof region.key !== "string" || !region.key.trim()) {
        issues.push({ path: at, message: "key fehlt." });
        return;
      }
      if (seen.has(region.key)) {
        issues.push({ path: at, message: `key "${region.key}" doppelt.` });
      }
      seen.add(region.key);
      if (typeof region.label !== "string" || !region.label.trim()) {
        issues.push({ path: at, message: "label fehlt." });
      }
    });
  }
  if (!Array.isArray(manifest.settings)) {
    issues.push({
      path: "settings",
      message: "settings muss eine Liste sein.",
    });
    return issues;
  }
  const seenKeys = new Set<string>();
  manifest.settings.forEach((field, index) => {
    const at = `settings[${index}]`;
    if (!field || typeof field.key !== "string" || !field.key.trim()) {
      issues.push({ path: at, message: "key fehlt." });
      return;
    }
    if (seenKeys.has(field.key)) {
      issues.push({ path: at, message: `key "${field.key}" doppelt.` });
    }
    seenKeys.add(field.key);
    if (typeof field.label !== "string" || !field.label.trim()) {
      issues.push({ path: `${at} (${field.key})`, message: "label fehlt." });
    }
    if (!FIELD_TYPES.includes(field.type)) {
      issues.push({
        path: `${at} (${field.key})`,
        message: `Unbekannter Feldtyp "${String(field.type)}". Erlaubt: ${FIELD_TYPES.join(", ")}.`,
      });
    }
    if (field.type === "select") {
      const options = (field as { options?: unknown }).options;
      const valid =
        Array.isArray(options) &&
        options.length > 0 &&
        options.every(
          (option) =>
            Array.isArray(option) &&
            option.length === 2 &&
            option.every((entry) => typeof entry === "string"),
        );
      if (!valid) {
        issues.push({
          path: `${at} (${field.key})`,
          message: "select braucht options als Liste von [wert, beschriftung].",
        });
      }
    }
  });
  return issues;
}

/**
 * Der Schlüssel des im Frontend-Projekt eingebauten Templates. Werte
 * dafür liegen im selben Speicher wie die der hochgeladenen, nur unter
 * diesem Namen – so gibt es genau EINEN Ort für Template-Werte.
 */
export const BUILTIN_TEMPLATE_KEY = "__builtin";

/**
 * `AppSettings.templateSettings` hält die Werte **je Template**:
 * `{ "__builtin": { … }, "nachtblau": { … } }`.
 *
 * Warum getrennt (Fund beim ersten echten Test, 2026-09-05): mit einem
 * gemeinsamen Topf gewinnen die gespeicherten Werte des vorigen Templates
 * über die Vorgaben des neuen, sobald beide denselben Schlüssel benutzen –
 * ein hochgeladenes dunkles Template blieb dadurch hell. Getrennt zeigt
 * jedes Template beim Aktivieren seine eigenen Vorgaben, und ein
 * Zurückschalten stellt die vorher gepflegten Werte wieder her.
 *
 * Der Speicher enthält für kurze Zeit noch die ALTE, flache Form
 * (Schlüssel → Wert statt Template → Werte). Sie wird beim Lesen als
 * Werte des eingebauten Templates verstanden – daran erkennbar, dass die
 * Werte keine Objekte sind.
 */
export type TemplateSettingsStore = Record<string, unknown>;

function isBucketShape(store: TemplateSettingsStore): boolean {
  const values = Object.values(store);
  if (values.length === 0) return true;
  return values.every(
    (value) =>
      typeof value === "object" && value !== null && !Array.isArray(value),
  );
}

/** Die Werte EINES Templates aus dem Speicher. */
export function templateSettingsFor(
  store: TemplateSettingsStore | null | undefined,
  templateKey: string,
): TemplateSettingsValues {
  if (!store) return {};
  if (!isBucketShape(store)) {
    // Alte, flache Form: sie gehörte dem eingebauten Template.
    return templateKey === BUILTIN_TEMPLATE_KEY
      ? (store as TemplateSettingsValues)
      : {};
  }
  const bucket = store[templateKey];
  return typeof bucket === "object" && bucket !== null
    ? (bucket as TemplateSettingsValues)
    : {};
}

/** Werte eines Templates in den Speicher schreiben, ohne die anderen
 * anzufassen. */
export function withTemplateSettings(
  store: TemplateSettingsStore | null | undefined,
  templateKey: string,
  values: TemplateSettingsValues,
): TemplateSettingsStore {
  const base: TemplateSettingsStore =
    store && isBucketShape(store)
      ? { ...store }
      : store
        ? { [BUILTIN_TEMPLATE_KEY]: store }
        : {};
  base[templateKey] = values;
  return base;
}
