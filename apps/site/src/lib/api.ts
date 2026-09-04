import type {
  ContentTypeField,
  GlobalModule,
  TemplateSettingsValues,
} from "@pivot/blocks";

// Serverseitige Basis-URL der eigenen Installation – nie NEXT_PUBLIC_,
// alle Aufrufe hier laufen ausschließlich in Server Components/Route
// Handlers (gleiches Muster wie apps/web/src/lib/api-server.ts).
const API_URL = process.env.API_URL ?? "http://localhost:3001/v1";

/** Kurze Cache-Zeit statt Rebuild/Webhook (Architekturentscheidung, siehe
 * knowledge-base/frontend/public-website.md): eine Seite wird höchstens
 * einmal pro Minute wirklich neu gerendert, alle Aufrufe dazwischen kommen
 * aus dem Next.js-Cache – im ungünstigsten Fall ist eine frische
 * Veröffentlichung also bis zu 60 Sekunden später öffentlich sichtbar. */
export const REVALIDATE_SECONDS = 60;

/** Ein Punkt aus einem der drei Menüs der Hülle. `href` ist bereits
 * aufgelöst (Startseite, Kategorie-Archiv, Beitrag mit Kategorie, externe
 * URL) – die Website muss keine Pfade mehr bauen. */
export interface SiteNavigationItem {
  id: string;
  label: string;
  href: string | null;
  openInNewTab: boolean;
  appearance: "LINK" | "TEXT_BUTTON" | "ACCENT_BUTTON";
  children: SiteNavigationItem[];
}

export interface SiteNavigation {
  id: string;
  name: string;
  slug: string;
  items: SiteNavigationItem[];
}

/** Rechtstext mit veröffentlichter Seite – die dritte Footer-Spalte. */
export interface SiteLegalLink {
  key: string;
  label: string;
  href: string;
}

export interface SiteSettings {
  siteTitle: string | null;
  siteTagline: string | null;
  faviconUrl: string | null;
  defaultSeoDescription: string | null;
  defaultOgImageUrl: string | null;
  publicBaseUrl: string | null;
  companyName: string | null;
  // Steuern die Zwischenspeicherung DIESER Website, siehe getCacheConfig().
  frontendCacheEnabled: boolean;
  frontendCacheTtlSeconds: number;
  footerNote: string | null;
  /** Werte der Einstellungen, die DIESES Template deklariert hat (siehe
   * src/template/manifest.ts). Schlüssel = `key` aus dem Manifest;
   * unbekannte Schlüssel können darin stehen, wenn das Manifest ein Feld
   * einmal hatte und nicht mehr hat. */
  templateSettings: TemplateSettingsValues | null;
  mainNavigationId: string | null;
  footerNavigationPrimaryId: string | null;
  footerNavigationSecondaryId: string | null;
  // Aufgelöste Menüs für Header und Footer – kommen aus demselben Aufruf,
  // damit das Layout die Hülle in EINEM Zug holt (siehe getSite() in
  // apps/api/src/public-content/public-content.service.ts).
  mainNavigation: SiteNavigation | null;
  footerNavigationPrimary: SiteNavigation | null;
  footerNavigationSecondary: SiteNavigation | null;
  legalLinks: SiteLegalLink[];
}

export interface CategoryRef {
  id: string;
  name: string;
  slug: string;
}

export interface TagRef {
  id: string;
  name: string;
  slug: string;
}

/** Projektion von `GET /public/pages/:slug` bzw.
 * `GET /public/categories/:slug/:contentSlug` (PublicContentService,
 * `contentFullSelect`). */
export interface PublicContent {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  isFeatured: boolean;
  publishedAt: string | null;
  updatedAt: string;
  locale: string;
  categories: CategoryRef[];
  tags: TagRef[];
  data: Record<string, unknown>;
  seoTitle: string | null;
  seoDescription: string | null;
  canonicalUrl: string | null;
  ogTitle: string | null;
  ogDescription: string | null;
  ogImageUrl: string | null;
  twitterCard: string | null;
  robotsIndex: boolean;
  robotsFollow: boolean;
  /** Blendet die sichtbare Überschrift aus – der Titel selbst bleibt für
   * `<title>` und Suchmaschinen erhalten. */
  hideTitle: boolean;
  /** Kanonischer Pfad, serverseitig berechnet (Kategorie-Präfix bzw.
   * flach – und `/` für die als Startseite markierte Seite, siehe
   * PublicContentService). */
  path: string;
  contentType: { slug: string; schema: { fields: ContentTypeField[] } };
}

export interface ModuleType {
  id: string;
  name: string;
  slug: string;
  icon: string | null;
  schema: { fields: ContentTypeField[] };
}

/** Die Inhalts-Endpunkte antworten bewusst immer mit 200 und einem
 * nullable `content` statt mit 404: Next.js schreibt fehlgeschlagene
 * Antworten nicht in seinen Data Cache und liefert stattdessen weiter den
 * letzten erfolgreichen Treffer aus – eine zurückgezogene Seite bliebe
 * dadurch praktisch unbegrenzt öffentlich sichtbar (nachgewiesen am
 * 2026-08-31, siehe knowledge-base/frontend/public-website.md). Die
 * 404-Behandlung hier bleibt als Sicherheitsnetz für Routen, die es
 * wirklich nicht gibt. */
/** Zwischenspeicher-Verhalten dieser Website, gesteuert unter
 * Einstellungen → Caching (Nutzervorgabe, 2026-09-03). Kommt aus
 * `/public/site` und damit aus derselben Antwort, die das Layout ohnehin
 * bei jedem Rendern holt – Next.js führt identische Aufrufe innerhalb
 * eines Renderdurchlaufs zusammen, es entsteht also keine zusätzliche
 * Anfrage.
 *
 * Diese eine Abfrage MUSS eine feste Dauer haben, sonst müsste man die
 * Einstellung kennen, um die Einstellung zu holen. `REVALIDATE_SECONDS`
 * ist dafür der richtige Wert: er entspricht dem `export const
 * revalidate = 60` der Seiten, unter das ohnehin niemand kommt. */
async function getCacheConfig(): Promise<{
  enabled: boolean;
  ttlSeconds: number;
}> {
  try {
    const res = await fetch(`${API_URL}/public/site`, {
      next: { revalidate: REVALIDATE_SECONDS },
    });
    if (!res.ok) return { enabled: true, ttlSeconds: REVALIDATE_SECONDS };
    const site = (await res.json()) as Partial<SiteSettings>;
    return {
      enabled: site.frontendCacheEnabled ?? true,
      ttlSeconds: site.frontendCacheTtlSeconds ?? REVALIDATE_SECONDS,
    };
  } catch {
    // Ist die API nicht erreichbar, greift der Vorgabewert. Eine
    // unerreichbare API ist ohnehin gleich das größere Problem und wird
    // vom eigentlichen Aufruf unten gemeldet.
    return { enabled: true, ttlSeconds: REVALIDATE_SECONDS };
  }
}

async function getJson<T>(path: string): Promise<T | null> {
  const cache = await getCacheConfig();
  const res = await fetch(`${API_URL}${path}`, {
    // Abgeschaltet heißt wirklich abgeschaltet: `no-store` nimmt die Route
    // zusätzlich aus der statischen Erzeugung heraus, die Seite wird also
    // bei jedem Aufruf frisch gerendert.
    ...(cache.enabled
      ? { next: { revalidate: cache.ttlSeconds } }
      : { cache: "no-store" as const }),
  });
  // 404 ist hier ein normaler Zustand (nicht veröffentlicht/gelöscht/kein
  // solcher Slug) und wird von den Seiten in Next.js' notFound() übersetzt,
  // nicht in eine Fehlerseite.
  if (res.status === 404) return null;
  if (!res.ok) {
    throw new Error(`Content-Delivery-API ${path}: HTTP ${res.status}`);
  }
  return (await res.json()) as T;
}

export async function getSiteSettings(): Promise<SiteSettings> {
  const settings = await getJson<SiteSettings>("/public/site");
  return (
    settings ?? {
      siteTitle: null,
      siteTagline: null,
      faviconUrl: null,
      defaultSeoDescription: null,
      defaultOgImageUrl: null,
      publicBaseUrl: null,
      companyName: null,
      frontendCacheEnabled: true,
      frontendCacheTtlSeconds: 60,
      footerNote: null,
      templateSettings: null,
      mainNavigationId: null,
      footerNavigationPrimaryId: null,
      footerNavigationSecondaryId: null,
      mainNavigation: null,
      footerNavigationPrimary: null,
      footerNavigationSecondary: null,
      legalLinks: [],
    }
  );
}

/** Abstand oben/unten der Zielseite eines Menüpunkts, in Pixeln, getrennt
 * nach Breakpoint (Nutzervorgabe, 2026-09-03: "bei jedem menüpunkt
 * unabhängig von der auswahl", "mobile und desktop", "bau noch tablet
 * ein"). `null` = kein eigener Wert, dann bleibt es beim Template; jede
 * Stufe erbt ohne eigenen Wert die nächstkleinere.
 *
 * Gesetzt wird das am Menüpunkt, nicht am Inhalt – das Backend löst auf,
 * welcher Menüpunkt auf die aufgerufene Seite zeigt (siehe
 * PublicContentService.resolveNavItem()). */
export interface PageSpacing {
  topMobile: number | null;
  bottomMobile: number | null;
  topTablet: number | null;
  bottomTablet: number | null;
  topDesktop: number | null;
  bottomDesktop: number | null;
}

const NO_SPACING: PageSpacing = {
  topMobile: null,
  bottomMobile: null,
  topTablet: null,
  bottomTablet: null,
  topDesktop: null,
  bottomDesktop: null,
};

/** Inhalt der Startseite – der Menüpunkt, der im Backend als Startseite
 * markiert ist (Navigation → Menüpunkt, Nutzervorgabe 2026-08-31).
 * `null`, solange keiner markiert ist: dann bleibt `/` eine 404. */
export async function getHome() {
  const res = await getJson<{
    content: PublicContent | null;
    spacing?: PageSpacing;
  }>("/public/home");
  if (!res?.content) return null;
  return { ...res.content, spacing: res.spacing ?? NO_SPACING };
}

export async function getPage(slug: string) {
  const res = await getJson<{
    content: PublicContent | null;
    spacing?: PageSpacing;
  }>(`/public/pages/${encodeURIComponent(slug)}`);
  if (!res?.content) return null;
  // Der Abstand hängt am Menüpunkt und kommt deshalb neben dem Inhalt an;
  // hier zusammengeführt, damit die Aufrufer weiter nur EIN Objekt haben.
  return { ...res.content, spacing: res.spacing ?? NO_SPACING };
}

/** Inhalt über einen Vorschau-Token (`?preview=…`) statt über den Slug –
 * zeigt bewusst auch noch nicht veröffentlichte Stände.
 *
 * Zwei Abweichungen von den übrigen Aufrufen hier, beide beabsichtigt:
 * `cache: "no-store"` statt der 60-Sekunden-Revalidierung (eine Vorschau
 * muss den Stand von JETZT zeigen, sonst sieht man seine eigene Änderung
 * bis zu einer Minute lang nicht), und ein 404 wird zu `null` – der Token
 * kann abgelaufen oder zurückgezogen sein.
 *
 * Ausstellen darf den Token nur, wer im Backend `preview-links:create`
 * besitzt (Nutzervorgabe, 2026-09-02: "da aber nur mit backendrecht bei
 * vorschau"). */
export async function getPreviewContent(token: string) {
  const res = await fetch(
    `${API_URL}/public/preview/${encodeURIComponent(token)}`,
    { cache: "no-store" },
  );
  if (!res.ok) return null;
  const body = (await res.json()) as { content: PublicContent | null };
  if (!body.content) return null;
  // Ohne Abstand: die Vorschau hängt an einem Token und kennt weder
  // Menüpunkt noch Seitenkontext. Das Feld ist trotzdem gesetzt, damit
  // Vorschau und normaler Weg dieselbe Form haben und die Seiten sie nicht
  // auseinanderhalten müssen.
  return { ...body.content, spacing: NO_SPACING };
}

/** Zusammenfassung eines Beitrags in der Archivliste (`contentSummarySelect`
 * im Backend) – deutlich schlanker als `PublicContent`, insbesondere ohne
 * `data`/Bausteine. */
export interface PublicContentSummary {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  isFeatured: boolean;
  publishedAt: string | null;
  updatedAt: string;
  locale: string;
  ogImageUrl: string | null;
  categories: CategoryRef[];
  tags: TagRef[];
}

/** Darstellung der Archivseite – am Menüpunkt gesetzt, nicht an der
 * Kategorie (Nutzerentscheidung, 2026-09-02); das Backend löst auf, welcher
 * Menüpunkt gilt. */
export type CategoryArchiveLayout = "LIST" | "BLOCKS";

/** Ein Beitrag in der Blog-Darstellung – wie die Zusammenfassung, aber
 * mit dem vollständigen Inhalt. Die Felder sind optional, weil dieselbe
 * Antwortform auch die Listen-Darstellung bedient; dort fehlen sie
 * bewusst (siehe contentBlogSelect im Backend). */
export interface PublicArchivePost extends PublicContentSummary {
  data?: Record<string, unknown>;
  contentType?: { slug: string; schema: { fields: ContentTypeField[] } };
}

export interface PublicCategoryArchive {
  category: {
    id: string;
    name: string;
    slug: string;
    description: string | null;
    color: string | null;
    rssEnabled: boolean;
  };
  layout: CategoryArchiveLayout;
  spacing: PageSpacing;
  /** Nur befüllt, wenn die Kategorie `showFeaturedLarge` gesetzt hat. */
  featured: PublicArchivePost | null;
  items: PublicArchivePost[];
  meta: { page: number; pageSize: number; total: number; pageCount: number };
}

/** Kategorie-Archiv (`/{kategorie}`). `null`, wenn es die Kategorie nicht
 * gibt oder ihre Archivseite nicht veröffentlicht ist – seit 2026-09-02
 * eine 200-Antwort mit `category: null` statt einer 404, aus demselben
 * Cache-Grund wie bei den Inhalts-Endpunkten (siehe `getJson`). */
export async function getCategoryArchive(slug: string, page: number) {
  const res = await getJson<PublicCategoryArchive | { category: null }>(
    `/public/categories/${encodeURIComponent(slug)}?page=${page}`,
  );
  if (!res || res.category === null) return null;
  const archive = res as PublicCategoryArchive;
  return { ...archive, spacing: archive.spacing ?? NO_SPACING };
}

/** Einzelner Beitrag innerhalb einer Kategorie (`/{kategorie}/{slug}`). */
export async function getCategoryPost(categorySlug: string, slug: string) {
  const res = await getJson<{
    content: PublicContent | null;
    spacing?: PageSpacing;
  }>(
    `/public/categories/${encodeURIComponent(categorySlug)}/${encodeURIComponent(slug)}`,
  );
  if (!res?.content) return null;
  // Wie bei getPage(): der Abstand kommt neben dem Inhalt an und wird hier
  // zusammengeführt, damit die Aufrufer nur EIN Objekt haben.
  return { ...res.content, spacing: res.spacing ?? NO_SPACING };
}

/** Modul-Typen und globale Module sind zum Auflösen von
 * `Content.data.blocks` nötig – die Ausgabe einer Seite darf nie von einer
 * Anmeldung abhängen.
 *
 * `/module-types` ist ein `@Public()`-Katalog (Baustein-Vorlagen, keine
 * Nutzerdaten). Die globalen Module (Galerien/FAQs) liefen bis 2026-09-02
 * über den inzwischen authentifizierten `/global-modules` und kommen
 * seitdem über `/public/global-modules` – inhaltlich dasselbe, aber sauber
 * getrennt vom rechtegefilterten Admin-Zugriff. */
export async function getBlockContext() {
  const [moduleTypes, globalModules] = await Promise.all([
    getJson<ModuleType[]>("/module-types"),
    getJson<GlobalModule[]>("/public/global-modules"),
  ]);
  return {
    moduleTypes: moduleTypes ?? [],
    globalModules: globalModules ?? [],
  };
}

/** Alle Menüs nach Id – für den Menü-Baustein in Template-Bereichen. Wird
 * nur im Layout geholt (dort stehen die Bereiche), nicht pro Seite. */
export async function getAllNavigations(): Promise<
  Record<string, SiteNavigation>
> {
  const navigations = await getJson<SiteNavigation[]>("/public/navigations");
  return Object.fromEntries((navigations ?? []).map((nav) => [nav.id, nav]));
}

/** Inhalt eines Template-Bereichs (Kopfbereich, Fußbereich, …) – dieselbe
 * Form wie `Content.data`: eine Liste von Bausteinen. */
export interface TemplateRegionContent {
  key: string;
  data: Record<string, unknown>;
  updatedAt: string | null;
}

/**
 * Alle im Backend gepflegten Bereiche, als Karte nach Schlüssel.
 *
 * Ein Bereich ohne Eintrag (oder mit leerer Baustein-Liste) ist der
 * Normalfall, solange niemand ihn bearbeitet hat – das Template zeigt dann
 * seine eingebaute Fassung. Erst wenn Bausteine drin sind, übernimmt der
 * Bereich (siehe layout.tsx). So bleibt eine bestehende Website beim
 * Einführen dieser Mechanik unverändert.
 */
export async function getTemplateRegions(): Promise<
  Record<string, TemplateRegionContent>
> {
  const regions = await getJson<TemplateRegionContent[]>(
    "/public/template-regions",
  );
  return Object.fromEntries(
    (regions ?? []).map((region) => [region.key, region]),
  );
}

/** Die Bausteine eines Bereichs – leer, wenn er nie bearbeitet wurde. */
export function regionBlocks(
  region: TemplateRegionContent | undefined,
): unknown[] {
  const blocks = (region?.data as { blocks?: unknown[] } | undefined)?.blocks;
  return Array.isArray(blocks) ? blocks : [];
}

/** Absolute URL für canonical/OG – ohne gepflegte `publicBaseUrl` gibt es
 * keine gültige absolute URL, dann bleibt das Feld bewusst leer statt eine
 * Domain zu erfinden (gleiches Prinzip wie bei Sitemap/RSS). */
export function absoluteUrl(
  publicBaseUrl: string | null,
  path: string,
): string | undefined {
  if (!publicBaseUrl) return undefined;
  return `${publicBaseUrl.replace(/\/$/, "")}${path}`;
}
