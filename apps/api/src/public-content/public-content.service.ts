import { Injectable, NotFoundException } from '@nestjs/common';
import { ContentStatus } from '@pivot/database';
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
  ogImageUrl: true,
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
            content: { select: { slug: true, status: true } },
          },
        },
      },
    });
    if (!navigation) {
      throw new NotFoundException(`Navigation "${slug}" nicht gefunden.`);
    }

    const visible = navigation.items.filter(
      (item) =>
        !item.content || item.content.status === ContentStatus.PUBLISHED,
    );
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
        href: item.isHomepage
          ? '/'
          : item.content
            ? `/${item.content.slug}`
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

  /** Inhalt der Startseite für `/` – 404, solange kein Menüpunkt als
   * Startseite markiert ist oder dessen Inhalt nicht (mehr)
   * veröffentlicht ist. Bewusst kein Fallback auf irgendeine andere
   * Seite: eine zufällig gewählte Startseite wäre schlimmer als eine
   * ehrliche 404. */
  async getHome() {
    const contentId = await this.findHomepageContentId();
    if (!contentId) {
      throw new NotFoundException('Es ist keine Startseite festgelegt.');
    }
    const content = await this.prisma.content.findFirst({
      where: {
        id: contentId,
        status: ContentStatus.PUBLISHED,
        deletedAt: null,
      },
      select: contentFullSelect,
    });
    if (!content) {
      throw new NotFoundException(
        'Die als Startseite festgelegte Seite ist nicht veröffentlicht.',
      );
    }
    return { ...mapRelations(content), path: '/' };
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
    if (!content) {
      throw new NotFoundException(`Seite "${slug}" nicht gefunden.`);
    }
    // Ist diese Seite die Startseite, ist `/` ihr kanonischer Pfad – sonst
    // wäre derselbe Inhalt unter `/` und `/{slug}` mit zwei
    // unterschiedlichen Canonicals erreichbar (Duplicate Content).
    const homepageContentId = await this.findHomepageContentId();
    const mapped = mapRelations(content);
    return {
      ...mapped,
      path: homepageContentId === content.id ? '/' : buildContentPath(mapped),
    };
  }

  /** Kategorie-Metadaten + paginierte veröffentlichte Beiträge – 404 wenn
   * die Kategorie ihre Archivseite nicht veröffentlicht hat
   * (`archivePublished`), respektiert `sortOrder`/`postsPerPage`. */
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
        archivePublished: true,
      },
    });
    if (!category || !category.archivePublished) {
      throw new NotFoundException(`Kategorie "${slug}" nicht gefunden.`);
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
      featured: featured ? mapRelations(featured) : null,
      items: items.map((item) => mapRelations(item)),
      meta: { page, pageSize, total, pageCount: Math.ceil(total / pageSize) },
    };
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
    if (!category) {
      throw new NotFoundException(
        `Kategorie "${categorySlug}" nicht gefunden.`,
      );
    }
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
    if (!content) {
      throw new NotFoundException(`Beitrag "${contentSlug}" nicht gefunden.`);
    }
    const mapped = mapRelations(content);
    return { ...mapped, path: buildContentPath(mapped) };
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
