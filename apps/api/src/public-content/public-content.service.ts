import { Injectable, NotFoundException } from '@nestjs/common';
import { CategoryArchiveLayout, ContentStatus } from '@pivot/database';
import { PrismaService } from '../prisma/prisma.service';
import { CategoriesService } from '../categories/categories.service';

// v1 geht von genau einer Sprache pro Installation aus (siehe
// knowledge-base/frontend/public-website.md-Plan, "bewusst nicht Teil
// dieser Planungsrunde: Mehrsprachigkeit/Locale-Routing") – `Content.locale`
// existiert im Datenmodell, ist aber noch nicht ans Routing angebunden.
const DEFAULT_LOCALE = 'de';

const FEED_ITEM_LIMIT_FALLBACK_PAGE_SIZE = 10;

// Antwortform bleibt auch dann gleich, wenn es gar keinen Inhalt gibt:
// das Frontend soll `spacing` nie auf `undefined` prüfen müssen.
const EMPTY_SPACING = {
  topMobile: null,
  bottomMobile: null,
  topTablet: null,
  bottomTablet: null,
  topDesktop: null,
  bottomDesktop: null,
} as const;

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

/** Wie {@link contentSummarySelect}, aber mit dem vollständigen Inhalt.
 *
 * Gebraucht von der Blog-Darstellung des Kategorie-Archivs (Nutzervorgabe,
 * 2026-09-03: "dieser Modus soll alle enthaltenen Beiträge untereinander
 * komplett darstellen"). Dort steht der Beitrag ausgeschrieben in der
 * Übersicht, nicht nur als Karte – dafür braucht die Website die Bausteine
 * und das Feld-Schema des Inhaltstyps.
 *
 * Bewusst NUR für diese eine Darstellung: die Listen-Darstellung soll
 * weiterhin die schlanke Zusammenfassung laden und nicht bei jeder
 * Übersichtsseite den kompletten Inhalt aller Beiträge mitschleppen. */
const contentBlogSelect = {
  ...contentSummarySelect,
  data: true,
  contentType: { select: { slug: true, schema: true } },
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
  hideTitle: true,
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
  constructor(
    private readonly prisma: PrismaService,
    private readonly categories: CategoriesService,
  ) {}

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
        mainNavigationId: true,
        footerNavigationPrimaryId: true,
        footerNavigationSecondaryId: true,
        footerNote: true,
        companyName: true,
        // Steuert die Zwischenspeicherung IN der Website (apps/site liest
        // das beim Rendern, siehe lib/api.ts) – deshalb Teil der
        // öffentlichen Hülle und nicht der geschützten Einstellungen.
        frontendCacheEnabled: true,
        frontendCacheTtlSeconds: true,
        // Werte der templateeigenen Einstellungen (2026-09-05). Gehören in
        // die öffentliche Hülle, weil das Template sie zum Rendern
        // braucht – die API weiß nicht einmal, was darin steht.
        templateSettings: true,
      },
    });
    const empty = {
      siteTitle: null,
      siteTagline: null,
      faviconUrl: null,
      defaultSeoDescription: null,
      defaultOgImageUrl: null,
      publicBaseUrl: null,
      mainNavigationId: null,
      footerNavigationPrimaryId: null,
      footerNavigationSecondaryId: null,
      footerNote: null,
      companyName: null,
      frontendCacheEnabled: true,
      frontendCacheTtlSeconds: 60,
      templateSettings: null,
    };
    const base = settings ?? empty;
    // Header und Footer der Website hängen an genau diesem Aufruf
    // (Nutzerentscheidung, 2026-09-02): das Layout holt die Hülle EINMAL,
    // statt für jedes Menü einen eigenen Aufruf zu machen. Alle drei
    // Menüs sind optional – ist keines gewählt, bleibt die jeweilige
    // Stelle leer, statt Einträge zu erfinden.
    const [mainNavigation, footerPrimary, footerSecondary, legalLinks] =
      await Promise.all([
        this.resolveNavigation({ id: base.mainNavigationId }),
        this.resolveNavigation({ id: base.footerNavigationPrimaryId }),
        this.resolveNavigation({ id: base.footerNavigationSecondaryId }),
        this.getLegalLinks(),
      ]);
    return {
      ...base,
      mainNavigation,
      footerNavigationPrimary: footerPrimary,
      footerNavigationSecondary: footerSecondary,
      legalLinks,
    };
  }

  /** Die Rechtstexte für die dritte Footer-Spalte (Nutzerentscheidung,
   * 2026-09-02: "Rechtliches automatisch"). Bewusst ohne Einstellung – wer
   * einen Rechtstext erzeugt, will ihn auch verlinkt haben.
   *
   * `LegalDocument.contentId` ist eine lose Referenz ohne Fremdschlüssel
   * (siehe Schema), deshalb ein zweiter Aufruf statt eines Joins. Ohne
   * erzeugte Seite (`contentId: null`, z.B. die noch nicht generierte
   * Barrierefreiheitserklärung) oder mit unveröffentlichter Seite fällt
   * der Eintrag weg – ein Link ins Leere ist schlechter als keiner. */
  private async getLegalLinks() {
    const documents = await this.prisma.legalDocument.findMany({
      where: { contentId: { not: null } },
      select: { key: true, title: true, contentId: true },
      orderBy: { title: 'asc' },
    });
    if (documents.length === 0) return [];
    const contents = await this.prisma.content.findMany({
      where: {
        id: { in: documents.map((d) => d.contentId!) },
        status: ContentStatus.PUBLISHED,
        deletedAt: null,
      },
      select: {
        id: true,
        slug: true,
        categories: {
          select: {
            category: { select: { id: true, name: true, slug: true } },
          },
        },
      },
    });
    const byId = new Map(contents.map((c) => [c.id, c]));
    return documents.flatMap((doc) => {
      const content = byId.get(doc.contentId!);
      if (!content) return [];
      return [
        {
          key: doc.key,
          label: doc.title,
          href: buildContentPath({
            slug: content.slug,
            categories: content.categories.map((c) => c.category),
          }),
        },
      ];
    });
  }

  /** Aufgelöster Menübaum, aber nur Einträge, deren Ziel-Inhalt
   * veröffentlicht ist (externe Links bleiben immer erhalten) – die
   * bestehende `NavigationService.findOne()` liefert das ungefiltert, das
   * ist für die Backend-Verwaltung korrekt, für die öffentliche Website
   * aber nicht. */
  async getNavigation(slug: string) {
    const navigation = await this.resolveNavigation({ slug });
    if (!navigation) {
      throw new NotFoundException(`Navigation "${slug}" nicht gefunden.`);
    }
    return navigation;
  }

  /** Gemeinsamer Kern von `getNavigation()` (nach Slug, für den
   * öffentlichen Endpunkt) und der Hülle in `getSite()` (nach Id, für
   * Hauptmenü und die beiden Footer-Spalten). Liefert `null` statt eines
   * Fehlers, weil eine nicht gesetzte Menü-Einstellung der Normalfall ist
   * und kein Fehler. */
  /** Alle Menüs, fertig aufgelöst – für den Menü-Baustein in einem
   * Template-Bereich (Stufe 2, 2026-09-05). Der Baustein speichert die Id
   * des gewählten Menüs; welche das ist, weiß die Website erst beim
   * Rendern, deshalb kommen alle auf einmal statt einer Abfrage je
   * Baustein.
   *
   * Unbedenklich: es sind genau die Menüs, die der Kopf- und Fußbereich
   * ohnehin öffentlich ausgibt (nicht erreichbare Ziele filtert
   * `resolveNavigation()` bereits heraus). */
  async getAllNavigations() {
    const navigations = await this.prisma.navigation.findMany({
      select: { id: true },
      orderBy: { name: 'asc' },
    });
    const resolved = await Promise.all(
      navigations.map((navigation) => this.resolveNavigation(navigation)),
    );
    return resolved.filter((navigation) => navigation !== null);
  }

  private async resolveNavigation(
    where: { slug: string } | { id: string | null },
  ) {
    if ('id' in where && !where.id) return null;
    const navigation = await this.prisma.navigation.findUnique({
      where: where as { slug: string } | { id: string },
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
            appearance: true,
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
    if (!navigation) return null;

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
        appearance: item.appearance,
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
    if (!content) return { content: null, spacing: EMPTY_SPACING };
    // Der Abstand hängt am Menüpunkt und am globalen Wert, nicht am
    // Inhalt (siehe resolveNavContext()) – für die Startseite ist das
    // genau der als Startseite markierte Punkt. `isHomepage`, damit der
    // Schalter "auch auf der Startseite" greifen kann.
    const { spacing } = await this.resolveNavContext(
      { contentId: content.id },
      { isHomepage: true },
    );
    return {
      content: { ...mapRelations(content), path: '/' },
      spacing,
    };
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
    if (!content) return { content: null, spacing: EMPTY_SPACING };
    // Ist diese Seite die Startseite, ist `/` ihr kanonischer Pfad – sonst
    // wäre derselbe Inhalt unter `/` und `/{slug}` mit zwei
    // unterschiedlichen Canonicals erreichbar (Duplicate Content).
    const homepageContentId = await this.findHomepageContentId();
    const mapped = mapRelations(content);
    // Auch `/{slug}` kann die Startseite sein (sie ist unter beiden URLs
    // erreichbar) – der Schalter muss deshalb hier genauso greifen.
    const { spacing } = await this.resolveNavContext(
      { contentId: content.id },
      { isHomepage: homepageContentId === content.id },
    );
    return {
      content: {
        ...mapped,
        path: homepageContentId === content.id ? '/' : buildContentPath(mapped),
      },
      spacing,
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
   * Der frühere Schalter `Category.archivePublished` ist am selben Tag
   * ganz entfallen – siehe knowledge-base/frontend/public-website.md.
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
        spacing: EMPTY_SPACING,
        featured: null,
        items: [],
        meta: null,
      };
    }

    // Die Darstellung entscheidet, WIE VIEL geladen wird, und muss
    // deshalb vor der Abfrage feststehen: die Blog-Darstellung schreibt
    // jeden Beitrag aus und braucht seine Bausteine, die Liste kommt mit
    // der Zusammenfassung aus (Nutzervorgabe, 2026-09-03).
    const { item: navItem, spacing } = await this.resolveNavContext({
      categoryId: category.id,
    });
    const layout = navItem?.categoryLayout ?? CategoryArchiveLayout.LIST;
    const select =
      layout === CategoryArchiveLayout.BLOCKS
        ? contentBlogSelect
        : contentSummarySelect;

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
            select,
          })
        : Promise.resolve(null),
      this.prisma.content.findMany({
        where,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
        select,
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
      layout,
      spacing,
      featured: featured ? mapRelations(featured) : null,
      items: items.map((item) => mapRelations(item)),
      meta: { page, pageSize, total, pageCount: Math.ceil(total / pageSize) },
    };
  }

  /** RSS-Feed einer Kategorie über ihren Slug. Löst nur den Slug auf und
   * gibt an `CategoriesService.generateFeed()` ab – der Feed wird an
   * genau einer Stelle gebaut, egal ob er über die Id (Backend) oder den
   * Slug (Website) angefordert wird. */
  async getCategoryFeed(slug: string): Promise<string | null> {
    const category = await this.prisma.category.findUnique({
      where: { slug },
      select: { id: true, deletedAt: true },
    });
    if (!category || category.deletedAt) return null;
    return this.categories.generateFeed(category.id);
  }

  /** Der Menüpunkt, über den ein Ziel veröffentlicht ist – und der daraus
   * fertig gemischte Abstand der Seite.
   *
   * Zwei Einstellungen sitzen am MENÜPUNKT statt am Inhalt: die
   * Darstellung der Kategorie-Übersicht (`categoryLayout`,
   * Nutzerentscheidung 2026-09-02) und der Abstand oben/unten
   * (`marginTop*`/`marginBottom*`, Nutzervorgabe 2026-09-03). Der Grund
   * ist derselbe: dasselbe Ziel darf an zwei Stellen im Menü
   * unterschiedlich aussehen.
   *
   * Die öffentliche URL ist aber nur `/{slug}` und weiß nicht, über
   * welchen Menüpunkt jemand gekommen ist. Deshalb wird hier
   * nachgeschlagen, welcher Menüpunkt auf dieses Ziel zeigt.
   *
   * Reihenfolge, damit das Ergebnis bei mehreren Treffern stabil und
   * nachvollziehbar bleibt: zuerst ein Punkt aus dem in den Einstellungen
   * gewählten Hauptmenü (`AppSettings.mainNavigationId`) – das ist das
   * Menü, das die Website tatsächlich anzeigt –, sonst der älteste
   * Menüpunkt überhaupt. `null`, wenn gar kein Menüpunkt auf das Ziel
   * zeigt.
   *
   * Der Abstand kommt aus ZWEI Quellen (seit 2026-09-03): dem globalen
   * Wert aus den Einstellungen (Frontend → "Abstand der Seite", gilt für
   * alle Seiten) und dem Wert am Menüpunkt. Gemischt wird Wert für Wert,
   * nicht als Paket – wer global 80 oben setzt und an einer Seite 0, hat
   * unten weiterhin den globalen Wert. So verhält sich der Menüpunkt wie
   * eine Ausnahme von der Regel und nicht wie ein Neuanfang. */
  private async resolveNavContext(
    target: { contentId: string } | { categoryId: string },
    options: { isHomepage?: boolean } = {},
  ) {
    const select = {
      categoryLayout: true,
      marginTopMobile: true,
      marginBottomMobile: true,
      marginTopTablet: true,
      marginBottomTablet: true,
      marginTopDesktop: true,
      marginBottomDesktop: true,
    } as const;
    const settings = await this.prisma.appSettings.findFirst({
      select: {
        mainNavigationId: true,
        pageSpacingTopMobile: true,
        pageSpacingBottomMobile: true,
        pageSpacingTopTablet: true,
        pageSpacingBottomTablet: true,
        pageSpacingTopDesktop: true,
        pageSpacingBottomDesktop: true,
        pageSpacingOnHomepage: true,
      },
    });
    // Erst das Hauptmenü, dann irgendein Menüpunkt – als Ausdruck und
    // nicht als `let`, damit Prisma den Typ der Auswahl behält.
    const inMain = settings?.mainNavigationId
      ? await this.prisma.navigationItem.findFirst({
          where: { ...target, navigationId: settings.mainNavigationId },
          orderBy: { createdAt: 'asc' },
          select,
        })
      : null;
    const item =
      inMain ??
      (await this.prisma.navigationItem.findFirst({
        where: target,
        orderBy: { createdAt: 'asc' },
        select,
      }));

    // Der globale Abstand gilt überall – außer auf der Startseite, wenn der
    // Schalter in den Einstellungen ihn dort abbestellt (Nutzervorgabe,
    // 2026-09-03: Startseiten fangen oft mit einem randlosen Aufmacher an,
    // der bündig sitzen soll). Ein am Menüpunkt gesetzter Wert ist davon
    // NICHT betroffen: der ist eine ausdrückliche Ansage für genau diese
    // Seite und sticht ohnehin.
    const globalApplies =
      !options.isHomepage || (settings?.pageSpacingOnHomepage ?? true);
    const global = (value: number | null | undefined) =>
      globalApplies ? (value ?? null) : null;

    return {
      item,
      spacing: {
        topMobile:
          item?.marginTopMobile ?? global(settings?.pageSpacingTopMobile),
        bottomMobile:
          item?.marginBottomMobile ?? global(settings?.pageSpacingBottomMobile),
        topTablet:
          item?.marginTopTablet ?? global(settings?.pageSpacingTopTablet),
        bottomTablet:
          item?.marginBottomTablet ?? global(settings?.pageSpacingBottomTablet),
        topDesktop:
          item?.marginTopDesktop ?? global(settings?.pageSpacingTopDesktop),
        bottomDesktop:
          item?.marginBottomDesktop ??
          global(settings?.pageSpacingBottomDesktop),
      },
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
    if (!category) return { content: null, spacing: EMPTY_SPACING };
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
    if (!content) return { content: null, spacing: EMPTY_SPACING };
    const mapped = mapRelations(content);
    // Auch ein Beitrag INNERHALB einer Kategorie bekommt den Abstand
    // (Fehlerbild 2026-09-03: "auf einer unterseite werden die werte nicht
    // gezeigt, startseite ja" – dieser Endpunkt lieferte gar kein
    // `spacing`). In aller Regel greift hier der globale Wert: Menüpunkte
    // zeigen auf die Übersichtsseite, nicht auf einzelne Beiträge. Zeigt
    // doch einer direkt auf diesen Inhalt, sticht dessen Wert wie überall.
    const homepageContentId = await this.findHomepageContentId();
    const { spacing } = await this.resolveNavContext(
      { contentId: content.id },
      { isHomepage: homepageContentId === content.id },
    );
    return {
      content: { ...mapped, path: buildContentPath(mapped) },
      spacing,
    };
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
