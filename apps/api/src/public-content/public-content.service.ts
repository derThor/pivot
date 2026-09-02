import { Injectable, NotFoundException } from '@nestjs/common';
import { CategoryArchiveLayout, ContentStatus } from '@pivot/database';
import { PrismaService } from '../prisma/prisma.service';

// v1 geht von genau einer Sprache pro Installation aus (siehe
// knowledge-base/frontend/public-website.md-Plan, "bewusst nicht Teil
// dieser Planungsrunde: Mehrsprachigkeit/Locale-Routing") – `Content.locale`
// existiert im Datenmodell, ist aber noch nicht ans Routing angebunden.
const DEFAULT_LOCALE = 'de';

const FEED_ITEM_LIMIT_FALLBACK_PAGE_SIZE = 10;

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

const contentSummarySelect = {
  id: true,
  title: true,
  slug: true,
  excerpt: true,
  isFeatured: true,
  publishedAt: true,
  updatedAt: true,
  locale: true,
  // Titelbild der Karten in der BLOCKS-Darstellung des Kategorie-Archivs
  // (seit 2026-09-02). Bewusst das vorhandene OG-Bild aus dem SEO-Tab
  // statt eines neuen Feldes: es ist das einzige echte "Bild dieser Seite"
  // im Datenmodell und hat im Editor schon einen Direkt-Upload.
  ogImageUrl: true,
  categories: {
    select: { category: { select: { id: true, name: true, slug: true } } },
  },
  tags: { select: { tag: { select: { id: true, name: true, slug: true } } } },
} as const;

const contentFullSelect = {
  ...contentSummarySelect,
  data: true,
  seoTitle: true,
  seoDescription: true,
  canonicalUrl: true,
  ogTitle: true,
  ogDescription: true,
  twitterCard: true,
  robotsIndex: true,
  robotsFollow: true,
  contentType: { select: { slug: true, schema: true } },
} as const;

function mapRelations<
  T extends {
    categories: { category: CategoryRef }[];
    tags: { tag: TagRef }[];
  },
>(
  content: T,
): Omit<T, 'categories' | 'tags'> & {
  categories: CategoryRef[];
  tags: TagRef[];
} {
  return {
    ...content,
    categories: content.categories.map((c) => c.category),
    tags: content.tags.map((t) => t.tag),
  };
}

/** Kategorie-Präfix für Beiträge (Content mit ≥1 Kategorie), flach für
 * freie Seiten – Nutzervorgabe, 2026-08-31 (Frontend-Architekturplan). */
function buildContentPath(content: {
  slug: string;
  categories: CategoryRef[];
}): string {
  const category = content.categories[0];
  return category ? `/${category.slug}/${content.slug}` : `/${content.slug}`;
}

@Injectable()
export class PublicContentService {
  constructor(private readonly prisma: PrismaService) {}

  /** Branding/SEO-Grundwerte fürs `<head>` der öffentlichen Website (siehe
   * AppSettings-Felder, Update 2026-08-31 – Frontend-Architekturplan). */
  async getSite() {
    const settings = await this.prisma.appSettings.findUnique({
      where: { id: 1 },
      select: {
        siteTitle: true,
        siteTagline: true,
        faviconUrl: true,
        defaultSeoDescription: true,
        defaultOgImageUrl: true,
        publicBaseUrl: true,
        accentColor: true,
        mainNavigationId: true,
      },
    });
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

  /** Aufgelöster Menübaum, aber nur Einträge, deren Ziel-Inhalt
   * veröffentlicht ist (externe Links bleiben immer erhalten) – die
   * bestehende `NavigationService.findOne()` liefert das ungefiltert, das
   * ist für die Backend-Verwaltung korrekt, für die öffentliche Website
   * aber nicht. */
  async getNavigation(slug: string) {
    const navigation = await this.prisma.navigation.findUnique({
      where: { slug },
      select: {
        id: true,
        name: true,
        slug: true,
        items: {
          orderBy: { sortOrder: 'asc' },
          select: {
            id: true,
            label: true,
            externalUrl: true,
            openInNewTab: true,
            parentId: true,
            isHomepage: true,
            content: {
              select: {
                slug: true,
                status: true,
                // Für den korrekten Pfad: ein Beitrag mit Kategorie liegt
                // unter `/{kategorie}/{slug}`, nicht unter `/{slug}`.
                categories: {
                  select: {
                    category: { select: { id: true, name: true, slug: true } },
                  },
                },
              },
            },
            category: {
              select: { slug: true, deletedAt: true },
            },
          },
        },
      },
    });
    if (!navigation) {
      throw new NotFoundException(`Navigation "${slug}" nicht gefunden.`);
    }

    // Menüpunkte, die ins Leere führen würden, tauchen im öffentlichen Menü
    // gar nicht erst auf: Inhalte, die nicht veröffentlicht sind, und
    // Kategorien im Papierkorb. Ein Menüpunkt auf eine lebende Kategorie
    // ist dagegen immer sichtbar – er IST seit 2026-09-02 die
    // Veröffentlichung ihrer Übersichtsseite (siehe getCategory()).
    const visible = navigation.items.filter((item) => {
      if (item.content) return item.content.status === ContentStatus.PUBLISHED;
      if (item.category) return !item.category.deletedAt;
      return true;
    });
    const byParent = new Map<string | null, typeof visible>();
    for (const item of visible) {
      const key = item.parentId;
      if (!byParent.has(key)) byParent.set(key, []);
      byParent.get(key)!.push(item);
    }
    const build = (parentId: string | null): unknown[] =>
      (byParent.get(parentId) ?? []).map((item) => ({
        id: item.id,
        label: item.label,
        externalUrl: item.externalUrl,
        openInNewTab: item.openInNewTab,
        // Der Startseiten-Punkt verlinkt auf `/`, nicht auf seinen Slug.
        // Für Inhalte gilt sonst dasselbe Pfad-Schema wie überall
        // (`buildContentPath`) – vorher stand hier fest `/{slug}`, was für
        // einen Beitrag MIT Kategorie auf eine 404-URL zeigte.
        href: item.isHomepage
          ? '/'
          : item.content
            ? buildContentPath({
                slug: item.content.slug,
                categories: item.content.categories.map((c) => c.category),
              })
            : item.category
              ? `/${item.category.slug}`
              : item.externalUrl,
        children: build(item.id),
      }));

    return {
      id: navigation.id,
      name: navigation.name,
      slug: navigation.slug,
      items: build(null),
    };
  }

  /** Der als Startseite markierte Menüpunkt (Nutzervorgabe, 2026-08-31:
   * die Startseite wird am Menüpunkt gesetzt, nicht in den Einstellungen).
   * App-weit gibt es höchstens einen – die Exklusivität stellt
   * NavigationService.updateItem() sicher. */
  private async findHomepageContentId(): Promise<string | null> {
    const item = await this.prisma.navigationItem.findFirst({
      where: { isHomepage: true, contentId: { not: null } },
      select: { contentId: true },
    });
    return item?.contentId ?? null;
  }

  /** Inhalt der Startseite für `/` – `{ content: null }`, solange kein
   * Menüpunkt als Startseite markiert ist oder dessen Inhalt nicht (mehr)
   * veröffentlicht ist. Bewusst kein Fallback auf irgendeine andere Seite.
   *
   * Warum 200 mit `content: null` statt HTTP 404 (Fund vom 2026-08-31):
   * Next.js schreibt **fehlgeschlagene** Antworten nicht in seinen Data
   * Cache und liefert bei einer 404 weiter den zuletzt erfolgreichen
   * Treffer aus – eine entfernte oder auf Entwurf gesetzte Startseite
   * blieb dadurch praktisch unbegrenzt öffentlich sichtbar. Eine immer
   * erfolgreiche, nullable Antwort ist cachebar und ersetzt den alten
   * Eintrag zuverlässig. */
  async getHome() {
    const contentId = await this.findHomepageContentId();
    if (!contentId) return { content: null };
    const content = await this.prisma.content.findFirst({
      where: {
        id: contentId,
        status: ContentStatus.PUBLISHED,
        deletedAt: null,
      },
      select: contentFullSelect,
    });
    if (!content) return { content: null };
    return { content: { ...mapRelations(content), path: '/' } };
  }

  /** Freie Seite (Content ohne Kategorie) – URL-Schema
   * `/{content-slug}` (siehe buildContentPath()). */
  async getPage(slug: string) {
    const content = await this.prisma.content.findFirst({
      where: {
        slug,
        locale: DEFAULT_LOCALE,
        status: ContentStatus.PUBLISHED,
        deletedAt: null,
        categories: { none: {} },
      },
      select: contentFullSelect,
    });
    // Nullable statt 404 – gleicher Grund wie bei getHome(): eine
    // zurückgezogene Seite blieb sonst über den Data Cache des Frontends
    // weiter sichtbar.
    if (!content) return { content: null };
    // Ist diese Seite die Startseite, ist `/` ihr kanonischer Pfad – sonst
    // wäre derselbe Inhalt unter `/` und `/{slug}` mit zwei
    // unterschiedlichen Canonicals erreichbar (Duplicate Content).
    const homepageContentId = await this.findHomepageContentId();
    const mapped = mapRelations(content);
    return {
      content: {
        ...mapped,
        path: homepageContentId === content.id ? '/' : buildContentPath(mapped),
      },
    };
  }

  /** Vorschau eines Inhalts auf der öffentlichen Website über einen
   * signierten, zeitlich begrenzten Token (`ContentPreviewToken`).
   *
   * Nutzervorgabe, 2026-09-02: der Vorschau-Knopf in der Seiten-Liste soll
   * die Seite im **Frontend** öffnen, "da aber nur mit backendrecht".
   * Genau das leistet der Token: ausstellen darf ihn nur, wer
   * `preview-links:create` besitzt (siehe
   * `ContentController.createPreviewLink`) – die Route hier prüft ihn nur
   * noch nach und braucht deshalb selbst keine Anmeldung, die es auf der
   * öffentlichen Website ohnehin nicht gibt.
   *
   * Bewusst **ohne** Status-Filter: eine Vorschau soll gerade den noch
   * nicht veröffentlichten Stand zeigen. Der Papierkorb bleibt außen vor.
   *
   * Gibt dieselbe Form zurück wie die übrigen Inhalts-Endpunkte
   * (`{ content }` inkl. `path`), damit `apps/site` denselben Renderer
   * benutzen kann – anders als das ältere `GET /content/preview/:token`,
   * das die rohe Admin-Projektion liefert. */
  async getPreview(token: string) {
    const link = await this.prisma.contentPreviewToken.findUnique({
      where: { token },
      select: { contentId: true, expiresAt: true },
    });
    if (!link || link.expiresAt.getTime() < Date.now()) {
      return { content: null };
    }
    const content = await this.prisma.content.findFirst({
      where: { id: link.contentId, deletedAt: null },
      select: contentFullSelect,
    });
    if (!content) return { content: null };
    const mapped = mapRelations(content);
    return { content: { ...mapped, path: buildContentPath(mapped) } };
  }

  /** Kategorie-Metadaten + paginierte veröffentlichte Beiträge.
   *
   * **Wann eine Übersichtsseite öffentlich ist:** sobald ein Menüpunkt auf
   * die Kategorie zeigt – und sonst nicht (Nutzerentscheidung, 2026-09-02:
   * "die zusätzliche Einstellung in der Kategorie wird nicht gebraucht").
   * Vorher gab es dafür den Schalter `Category.archivePublished`, der
   * zusätzlich zum Menüpunkt gesetzt werden musste; zwei Stellen für
   * dieselbe Aussage, von denen man die zweite nicht fand.
   *
   * Das Feld `archivePublished` existiert noch in der Datenbank, wird aber
   * nirgends mehr ausgewertet – siehe knowledge-base/frontend/public-website.md.
   *
   * Respektiert weiterhin `sortOrder`/`postsPerPage`. */
  async getCategory(slug: string, page: number) {
    const category = await this.prisma.category.findFirst({
      where: { slug, deletedAt: null },
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        color: true,
        rssEnabled: true,
        showFeaturedLarge: true,
        sortOrder: true,
        postsPerPage: true,
      },
    });
    const linkedFromMenu = category
      ? (await this.prisma.navigationItem.count({
          where: { categoryId: category.id },
        })) > 0
      : false;
    // Seit 2026-09-02 `{ category: null }` statt 404 – derselbe Grund wie
    // bei getHome()/getPage() (offener Roadmap-Punkt, jetzt erledigt):
    // Next.js cached fehlgeschlagene Antworten nicht und lieferte sonst
    // nach dem Zurückziehen einer Übersichtsseite weiter den alten Stand aus.
    if (!category || !linkedFromMenu) {
      return {
        category: null,
        layout: null,
        featured: null,
        items: [],
        meta: null,
      };
    }

    const pageSize =
      category.postsPerPage ?? FEED_ITEM_LIMIT_FALLBACK_PAGE_SIZE;
    const orderBy =
      category.sortOrder === 'OLDEST'
        ? ({ publishedAt: 'asc' } as const)
        : ({ publishedAt: 'desc' } as const);

    const where = {
      status: ContentStatus.PUBLISHED,
      deletedAt: null,
      categories: { some: { categoryId: category.id } },
    };

    const [featured, items, total] = await Promise.all([
      category.showFeaturedLarge
        ? this.prisma.content.findFirst({
            where: { ...where, isFeatured: true },
            orderBy: { publishedAt: 'desc' },
            select: contentSummarySelect,
          })
        : Promise.resolve(null),
      this.prisma.content.findMany({
        where,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: contentSummarySelect,
      }),
      this.prisma.content.count({ where }),
    ]);

    return {
      category: {
        id: category.id,
        name: category.name,
        slug: category.slug,
        description: category.description,
        color: category.color,
        rssEnabled: category.rssEnabled,
      },
      layout: await this.resolveArchiveLayout(category.id),
      featured: featured ? mapRelations(featured) : null,
      items: items.map((item) => mapRelations(item)),
      meta: { page, pageSize, total, pageCount: Math.ceil(total / pageSize) },
    };
  }

  /** Welche Darstellung (Liste/Blöcke) die Übersichtsseite bekommt.
   *
   * Die Einstellung sitzt am MENÜPUNKT, nicht an der Kategorie
   * (Nutzerentscheidung, 2026-09-02) – die öffentliche URL ist aber nur
   * `/{slug}` und weiß nicht, über welchen Menüpunkt jemand gekommen ist.
   * Deshalb wird hier nachgeschlagen, welcher Menüpunkt auf diese
   * Kategorie zeigt.
   *
   * Reihenfolge, damit das Ergebnis bei mehreren Treffern stabil und
   * nachvollziehbar bleibt: zuerst ein Punkt aus dem in den Einstellungen
   * gewählten Hauptmenü (`AppSettings.mainNavigationId`) – das ist das
   * Menü, das die Website tatsächlich anzeigt –, sonst der älteste
   * Menüpunkt überhaupt. Zeigt gar kein Menüpunkt auf die Kategorie
   * (Übersichtsseite direkt aufgerufen), gilt der Default `LIST`. */
  private async resolveArchiveLayout(
    categoryId: string,
  ): Promise<CategoryArchiveLayout> {
    const settings = await this.prisma.appSettings.findFirst({
      select: { mainNavigationId: true },
    });
    if (settings?.mainNavigationId) {
      const inMain = await this.prisma.navigationItem.findFirst({
        where: { categoryId, navigationId: settings.mainNavigationId },
        orderBy: { createdAt: 'asc' },
        select: { categoryLayout: true },
      });
      if (inMain) return inMain.categoryLayout;
    }
    const anyItem = await this.prisma.navigationItem.findFirst({
      where: { categoryId },
      orderBy: { createdAt: 'asc' },
      select: { categoryLayout: true },
    });
    return anyItem?.categoryLayout ?? CategoryArchiveLayout.LIST;
  }

  /** Einzelner Beitrag innerhalb einer Kategorie – URL-Schema
   * `/{kategorie-slug}/{content-slug}`. 404 bei falscher Kategorie-
   * Zuordnung, nicht nur bei fehlendem Content, sonst wäre ein Beitrag
   * unter jeder beliebigen Kategorie-URL erreichbar. */
  async getCategoryPost(categorySlug: string, contentSlug: string) {
    const category = await this.prisma.category.findFirst({
      where: { slug: categorySlug, deletedAt: null },
      select: { id: true },
    });
    if (!category) return { content: null };
    const content = await this.prisma.content.findFirst({
      where: {
        slug: contentSlug,
        locale: DEFAULT_LOCALE,
        status: ContentStatus.PUBLISHED,
        deletedAt: null,
        categories: { some: { categoryId: category.id } },
      },
      select: contentFullSelect,
    });
    if (!content) return { content: null };
    const mapped = mapRelations(content);
    return { content: { ...mapped, path: buildContentPath(mapped) } };
  }

  /** Sitemap über alle veröffentlichten Seiten/Beiträge, `robotsIndex`
   * respektierend – ohne gesetzte `publicBaseUrl` gibt es keine gültigen
   * absoluten URLs, daher dann eine leere Sitemap statt einer erfundenen
   * Domain (gleiches Prinzip wie beim RSS-Feed-`<link>`). */
  async getSitemapEntries(): Promise<{ path: string; updatedAt: Date }[]> {
    const settings = await this.prisma.appSettings.findUnique({
      where: { id: 1 },
      select: { publicBaseUrl: true },
    });
    if (!settings?.publicBaseUrl) return [];

    const homepageContentId = await this.findHomepageContentId();
    const items = await this.prisma.content.findMany({
      where: {
        status: ContentStatus.PUBLISHED,
        deletedAt: null,
        robotsIndex: true,
      },
      select: {
        id: true,
        slug: true,
        updatedAt: true,
        categories: {
          select: {
            category: { select: { id: true, name: true, slug: true } },
          },
        },
      },
    });
    return items.map((item) => ({
      path:
        item.id === homepageContentId
          ? '/'
          : buildContentPath({
              slug: item.slug,
              categories: item.categories.map((c) => c.category),
            }),
      updatedAt: item.updatedAt,
    }));
  }
}
