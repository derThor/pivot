import type { ContentTypeField, GlobalModule } from "@pivot/blocks";

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
  accentColor: string | null;
  companyName: string | null;
  // Steuern die Zwischenspeicherung DIESER Website, siehe getCacheConfig().
  frontendCacheEnabled: boolean;
  frontendCacheTtlSeconds: number;
  footerNote: string | null;
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
      accentColor: null,
      companyName: null,
      frontendCacheEnabled: true,
      frontendCacheTtlSeconds: 60,
      footerNote: null,
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

/** Inhalt der Startseite – der Menüpunkt, der im Backend als Startseite
 * markiert ist (Navigation → Menüpunkt, Nutzervorgabe 2026-08-31).
 * `null`, solange keiner markiert ist: dann bleibt `/` eine 404. */
export async function getHome() {
  const res = await getJson<{ content: PublicContent | null }>("/public/home");
  return res?.content ?? null;
}

export async function getPage(slug: string) {
  const res = await getJson<{ content: PublicContent | null }>(
    `/public/pages/${encodeURIComponent(slug)}`,
  );
  return res?.content ?? null;
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
  return body.content;
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
  /** Nur befüllt, wenn die Kategorie `showFeaturedLarge` gesetzt hat. */
  featured: PublicContentSummary | null;
  items: PublicContentSummary[];
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
  return res as PublicCategoryArchive;
}

/** Einzelner Beitrag innerhalb einer Kategorie (`/{kategorie}/{slug}`). */
export async function getCategoryPost(categorySlug: string, slug: string) {
  const res = await getJson<{ content: PublicContent | null }>(
    `/public/categories/${encodeURIComponent(categorySlug)}/${encodeURIComponent(slug)}`,
  );
  return res?.content ?? null;
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
