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

export interface SiteSettings {
  siteTitle: string | null;
  siteTagline: string | null;
  faviconUrl: string | null;
  defaultSeoDescription: string | null;
  defaultOgImageUrl: string | null;
  publicBaseUrl: string | null;
  accentColor: string | null;
  mainNavigationId: string | null;
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

async function getJson<T>(path: string): Promise<T | null> {
  const res = await fetch(`${API_URL}${path}`, {
    next: { revalidate: REVALIDATE_SECONDS },
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
      mainNavigationId: null,
    }
  );
}

/** Inhalt der Startseite – der Menüpunkt, der im Backend als Startseite
 * markiert ist (Navigation → Menüpunkt, Nutzervorgabe 2026-08-31).
 * `null`, solange keiner markiert ist: dann bleibt `/` eine 404. */
export function getHome() {
  return getJson<PublicContent>("/public/home");
}

export function getPage(slug: string) {
  return getJson<PublicContent>(`/public/pages/${encodeURIComponent(slug)}`);
}

/** Modul-Typen und globale Module sind zum Auflösen von
 * `Content.data.blocks` nötig; beide Endpunkte sind bereits `@Public()`
 * (ursprünglich für die anonyme Vorschauseite in apps/web). */
export async function getBlockContext() {
  const [moduleTypes, globalModules] = await Promise.all([
    getJson<ModuleType[]>("/module-types"),
    getJson<GlobalModule[]>("/global-modules"),
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
