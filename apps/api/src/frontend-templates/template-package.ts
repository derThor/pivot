/**
 * Auspacken und Prüfen eines Template-Pakets (Nutzerentscheidung,
 * 2026-09-05: ZIP mit `template.json`, `theme.css`, optional
 * `regions.json` und `assets/`).
 *
 * Diese Datei enthält bewusst keine Datenbank- und keine Dateisystem-
 * Zugriffe: sie bekommt einen Puffer und liefert geprüfte Bestandteile.
 * Dadurch ist der heikelste Teil – die CSS-Prüfung – ohne Umgebung
 * testbar.
 */
import AdmZip from 'adm-zip';
import { BadRequestException } from '@nestjs/common';

/** Was ein Paket mitbringen darf. Alles andere wird ignoriert, nicht
 * abgelehnt: ein `README.md` im ZIP ist kein Fehler. */
const MANIFEST_FILE = 'template.json';
const CSS_FILE = 'theme.css';
const REGIONS_FILE = 'regions.json';
const ASSET_PREFIX = 'assets/';

/** Dateiendungen, die als Asset durchgehen. Streng, weil diese Dateien
 * später öffentlich ausgeliefert werden: Bilder, Schriften, sonst nichts.
 * Kein SVG – es kann Skript enthalten, und die Medienbibliothek behandelt
 * SVGs deshalb schon heute gesondert (Content-Disposition: attachment),
 * was für eine Schrift oder ein Hintergrundbild im CSS nutzlos wäre. */
const ASSET_EXTENSIONS = [
  '.png',
  '.jpg',
  '.jpeg',
  '.webp',
  '.avif',
  '.gif',
  '.ico',
  '.woff',
  '.woff2',
  '.ttf',
  '.otf',
];

const MAX_CSS_BYTES = 512 * 1024;
const MAX_ASSET_BYTES = 5 * 1024 * 1024;
const MAX_ASSETS = 50;

export interface TemplatePackageAsset {
  /** Dateiname ohne Pfad – Unterordner unter `assets/` werden bewusst
   * flachgeklopft, damit die ausgelieferten Pfade vorhersagbar bleiben. */
  name: string;
  data: Buffer;
}

export interface TemplatePackage {
  key: string;
  name: string;
  version?: string;
  manifest: Record<string, unknown>;
  css: string;
  regions: Record<string, unknown> | null;
  assets: TemplatePackageAsset[];
}

/**
 * Prüft das CSS eines Pakets.
 *
 * Erlaubt ist praktisch alles – **außer Verweisen nach draußen**
 * (Nutzerentscheidung, 2026-09-05: "Frei, aber ohne externe Adressen").
 * Grund: ein Stylesheet, das eine fremde Schrift oder ein fremdes Bild
 * lädt, meldet jeden Seitenaufruf an diesen Server. Das wäre mit der
 * Datenschutz-Haltung dieses Projekts nicht vereinbar und ließe sich von
 * außen nicht ansehen – es steht ja im CSS, nicht in der Seite.
 *
 * Geprüft wird auf Textebene, nicht mit einem CSS-Parser: gesucht sind
 * `@import` und absolute Adressen in `url(...)`. Ein Parser wäre
 * genauer, aber die Regel ist bewusst grob – im Zweifel abgelehnt, damit
 * niemand eine Lücke sucht.
 */
export function assertSafeCss(css: string): void {
  if (Buffer.byteLength(css, 'utf8') > MAX_CSS_BYTES) {
    throw new BadRequestException(
      `theme.css ist größer als ${MAX_CSS_BYTES / 1024} KB.`,
    );
  }
  if (/@import\b/i.test(css)) {
    throw new BadRequestException(
      '@import ist nicht erlaubt: ein Template darf keine fremden Stylesheets nachladen.',
    );
  }
  const urls = [...css.matchAll(/url\(\s*(['"]?)([^)'"]+)\1\s*\)/gi)];
  for (const match of urls) {
    const target = match[2].trim();
    if (target.startsWith('data:')) continue;
    if (
      /^(https?:)?\/\//i.test(target) ||
      /^[a-z][a-z0-9+.-]*:/i.test(target)
    ) {
      throw new BadRequestException(
        `Externe Adresse im CSS: "${target}". Schriften und Bilder müssen aus dem Paket kommen (assets/).`,
      );
    }
  }
}

/** `./assets/schrift.woff2` → `/uploads/templates/<id>/schrift.woff2`.
 *
 * Ausgeliefert werden die Dateien vom statischen Ordner der API (siehe
 * main.ts) – das Umschreiben passiert einmal beim Import, nicht bei jedem
 * Seitenaufruf. */
export function rewriteAssetUrls(css: string, baseUrl: string): string {
  return css.replace(
    /url\(\s*(['"]?)\.?\/?assets\/([^)'"]+)\1\s*\)/gi,
    (_match, _quote: string, file: string) =>
      `url("${baseUrl}/${file.trim()}")`,
  );
}

function readJson(zip: AdmZip, file: string): Record<string, unknown> | null {
  const entry = zip.getEntry(file);
  if (!entry) return null;
  try {
    const parsed: unknown = JSON.parse(entry.getData().toString('utf8'));
    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      Array.isArray(parsed)
    ) {
      throw new Error('kein Objekt');
    }
    return parsed as Record<string, unknown>;
  } catch (error) {
    throw new BadRequestException(
      `${file} ist kein gültiges JSON-Objekt: ${
        error instanceof Error ? error.message : 'unbekannter Fehler'
      }`,
    );
  }
}

/** Aus einem Namen einen stabilen Schlüssel machen: Kleinbuchstaben,
 * Ziffern, Bindestriche. */
export function toTemplateKey(value: string): string {
  const key = value
    .toLowerCase()
    .replace(/[äöüß]/g, (char) =>
      char === 'ä' ? 'ae' : char === 'ö' ? 'oe' : char === 'ü' ? 'ue' : 'ss',
    )
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return key || 'template';
}

/**
 * Liest ein hochgeladenes ZIP.
 *
 * `assetBaseUrl` ist die spätere öffentliche Basis der Dateien dieses
 * Templates – sie muss beim Import feststehen, weil die Pfade im CSS
 * sofort umgeschrieben werden.
 */
export function readTemplatePackage(
  buffer: Buffer,
  assetBaseUrl: string,
): TemplatePackage {
  let zip: AdmZip;
  try {
    zip = new AdmZip(buffer);
  } catch {
    throw new BadRequestException('Die Datei ist kein lesbares ZIP-Archiv.');
  }

  const meta = readJson(zip, MANIFEST_FILE);
  if (!meta) {
    throw new BadRequestException(
      `Im Paket fehlt ${MANIFEST_FILE} – dort stehen Name und Manifest.`,
    );
  }
  const name = typeof meta.name === 'string' ? meta.name.trim() : '';
  if (!name) {
    throw new BadRequestException(`In ${MANIFEST_FILE} fehlt "name".`);
  }
  // Das Manifest darf entweder direkt in template.json stehen (dann ist
  // die Datei selbst das Manifest) oder unter "manifest" – beides kommt
  // vor, je nachdem ob jemand den Entwurf aus dem Generator übernommen
  // oder von Hand geschrieben hat.
  const manifest =
    typeof meta.manifest === 'object' && meta.manifest !== null
      ? (meta.manifest as Record<string, unknown>)
      : meta;

  const cssEntry = zip.getEntry(CSS_FILE);
  const rawCss = cssEntry ? cssEntry.getData().toString('utf8') : '';
  assertSafeCss(rawCss);
  const css = rewriteAssetUrls(rawCss, assetBaseUrl);

  const regions = readJson(zip, REGIONS_FILE);

  const assets: TemplatePackageAsset[] = [];
  for (const entry of zip.getEntries()) {
    if (entry.isDirectory) continue;
    const path = entry.entryName.replace(/\\/g, '/');
    if (!path.startsWith(ASSET_PREFIX)) continue;
    const fileName = path.slice(ASSET_PREFIX.length).split('/').pop() ?? '';
    if (!fileName) continue;
    const extension = fileName.slice(fileName.lastIndexOf('.')).toLowerCase();
    if (!ASSET_EXTENSIONS.includes(extension)) {
      throw new BadRequestException(
        `Nicht erlaubter Dateityp im Paket: ${fileName}. Erlaubt sind Bilder und Schriften (${ASSET_EXTENSIONS.join(', ')}).`,
      );
    }
    const data = entry.getData();
    if (data.byteLength > MAX_ASSET_BYTES) {
      throw new BadRequestException(
        `${fileName} ist größer als ${MAX_ASSET_BYTES / 1024 / 1024} MB.`,
      );
    }
    assets.push({ name: fileName, data });
    if (assets.length > MAX_ASSETS) {
      throw new BadRequestException(
        `Mehr als ${MAX_ASSETS} Dateien im Paket – das ist kein Template mehr.`,
      );
    }
  }

  return {
    key: toTemplateKey(typeof meta.key === 'string' ? meta.key : name),
    name,
    version: typeof meta.version === 'string' ? meta.version : undefined,
    manifest,
    css,
    regions,
    assets,
  };
}
