import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { SiteCacheService } from '../site-cache/site-cache.service';
import { CreateNavigationDto } from './dto/create-navigation.dto';
import { UpdateNavigationDto } from './dto/update-navigation.dto';
import { CreateNavigationItemDto } from './dto/create-navigation-item.dto';
import { UpdateNavigationItemDto } from './dto/update-navigation-item.dto';
import { ReorderNavigationItemsDto } from './dto/reorder-navigation-items.dto';
import { QueryNavigationDto } from './dto/query-navigation.dto';

const itemSelect = {
  id: true,
  label: true,
  externalUrl: true,
  openInNewTab: true,
  isHomepage: true,
  sortOrder: true,
  parentId: true,
  contentId: true,
  content: { select: { id: true, title: true, slug: true, status: true } },
  categoryId: true,
  categoryLayout: true,
  appearance: true,
  category: {
    select: { id: true, name: true, slug: true },
  },
} as const;

@Injectable()
export class NavigationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
    private readonly siteCache: SiteCacheService,
  ) {}

  async findAll(query: QueryNavigationDto) {
    const { page, pageSize } = query;
    const [items, total] = await Promise.all([
      this.prisma.navigation.findMany({
        orderBy: { name: 'asc' },
        include: { _count: { select: { items: true } } },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.navigation.count(),
    ]);
    return {
      items,
      meta: { page, pageSize, total, pageCount: Math.ceil(total / pageSize) },
    };
  }

  async findOne(id: string) {
    const navigation = await this.prisma.navigation.findUnique({
      where: { id },
      include: { items: { select: itemSelect, orderBy: { sortOrder: 'asc' } } },
    });
    if (!navigation) {
      throw new NotFoundException(`Navigation ${id} nicht gefunden.`);
    }
    const { items, ...rest } = navigation;
    return { ...rest, items: this.buildItemTree(items) };
  }

  private buildItemTree<T extends { id: string; parentId: string | null }>(
    items: T[],
  ): (T & { children: unknown[] })[] {
    const byParent = new Map<string | null, T[]>();
    for (const item of items) {
      const key = item.parentId;
      if (!byParent.has(key)) byParent.set(key, []);
      byParent.get(key)!.push(item);
    }
    const build = (parentId: string | null): (T & { children: unknown[] })[] =>
      (byParent.get(parentId) ?? []).map((item) => ({
        ...item,
        children: build(item.id),
      }));
    return build(null);
  }

  private async assertSlugUnique(slug: string, excludeId?: string) {
    const existing = await this.prisma.navigation.findFirst({
      where: { slug, ...(excludeId && { id: { not: excludeId } }) },
    });
    if (existing) {
      throw new ConflictException(
        'Eine Navigation mit diesem Slug existiert bereits.',
      );
    }
  }

  // Menüs bilden Header und Footer der Website (siehe SiteHeader/
  // SiteFooter in apps/site) – jede Änderung muss dort sofort ankommen.
  async create(dto: CreateNavigationDto) {
    this.siteCache.invalidate('navigation.changed');
    await this.assertSlugUnique(dto.slug);
    return this.prisma.navigation.create({ data: dto });
  }

  async update(id: string, dto: UpdateNavigationDto) {
    this.siteCache.invalidate('navigation.changed');
    if (dto.slug) {
      await this.assertSlugUnique(dto.slug, id);
    }
    await this.assertNavigationExists(id);
    return this.prisma.navigation.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    this.siteCache.invalidate('navigation.changed');
    await this.assertNavigationExists(id);
    await this.prisma.navigation.delete({ where: { id } });
  }

  private async assertNavigationExists(id: string) {
    const exists = await this.prisma.navigation.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!exists) {
      throw new NotFoundException(`Navigation ${id} nicht gefunden.`);
    }
  }

  // Seit 2026-09-02 drei mögliche Ziele (Inhalt / Kategorie-Archiv /
  // externe URL) statt zwei – daher gezählt statt paarweise verglichen.
  private assertExactlyOneTarget(dto: {
    contentId?: string | null;
    categoryId?: string | null;
    externalUrl?: string | null;
  }) {
    const targets = [dto.contentId, dto.categoryId, dto.externalUrl].filter(
      Boolean,
    ).length;
    if (targets !== 1) {
      throw new BadRequestException(
        'Ein Navigationspunkt braucht genau ein Ziel: einen Inhalt, eine Kategorie oder eine externe URL.',
      );
    }
  }

  private async assertCategoryExists(categoryId: string) {
    const exists = await this.prisma.category.findUnique({
      where: { id: categoryId },
      select: { id: true, deletedAt: true },
    });
    if (!exists || exists.deletedAt) {
      throw new BadRequestException('Ziel-Kategorie nicht gefunden.');
    }
  }

  async createItem(navigationId: string, dto: CreateNavigationItemDto) {
    this.siteCache.invalidate('navigation.changed');
    await this.assertNavigationExists(navigationId);
    this.assertExactlyOneTarget(dto);
    if (dto.contentId) {
      await this.assertContentExists(dto.contentId);
    }
    if (dto.categoryId) {
      await this.assertCategoryExists(dto.categoryId);
    }
    if (dto.parentId) {
      await this.assertItemInNavigation(navigationId, dto.parentId);
    }
    const maxSortOrder = await this.prisma.navigationItem.aggregate({
      where: { navigationId, parentId: dto.parentId ?? null },
      _max: { sortOrder: true },
    });
    return this.prisma.navigationItem.create({
      data: {
        navigationId,
        label: dto.label,
        contentId: dto.contentId ?? null,
        categoryId: dto.categoryId ?? null,
        ...(dto.categoryLayout && { categoryLayout: dto.categoryLayout }),
        ...(dto.appearance && { appearance: dto.appearance }),
        externalUrl: dto.externalUrl ?? null,
        parentId: dto.parentId ?? null,
        openInNewTab: dto.openInNewTab ?? false,
        sortOrder: (maxSortOrder._max.sortOrder ?? -1) + 1,
      },
      select: itemSelect,
    });
  }

  /** `userId` wird nur für den Aktivitäts-Eintrag der Startseiten-
   * Umschaltung gebraucht (siehe unten) – alle übrigen Feldänderungen an
   * Menüpunkten werden bewusst nicht protokolliert, das wäre für dieses
   * Modul neu und ist nicht Teil dieser Änderung. */
  async updateItem(
    navigationId: string,
    itemId: string,
    dto: UpdateNavigationItemDto,
    userId?: string,
  ) {
    this.siteCache.invalidate('navigation.changed');
    const existing = await this.assertItemInNavigation(navigationId, itemId);
    const effectiveContentId =
      dto.contentId !== undefined ? dto.contentId : existing.contentId;
    const effectiveExternalUrl =
      dto.externalUrl !== undefined ? dto.externalUrl : existing.externalUrl;
    const effectiveCategoryId =
      dto.categoryId !== undefined ? dto.categoryId : existing.categoryId;
    this.assertExactlyOneTarget({
      contentId: effectiveContentId,
      categoryId: effectiveCategoryId,
      externalUrl: effectiveExternalUrl,
    });
    if (dto.contentId) {
      await this.assertContentExists(dto.contentId);
    }
    if (dto.categoryId) {
      await this.assertCategoryExists(dto.categoryId);
    }
    if (dto.parentId !== undefined && dto.parentId) {
      await this.assertItemInNavigation(navigationId, dto.parentId);
      await this.assertNoItemCycle(itemId, dto.parentId);
    }
    // Startseite: genau ein Menüpunkt app-weit (Nutzervorgabe,
    // 2026-08-31). Ein externer Link kann keine Startseite sein – die
    // Startseite muss einen echten Inhalt rendern. Ein Kategorie-Archiv
    // ebenfalls nicht: `getHome()` liefert genau EINEN Content, eine
    // Übersichtsseite als Startseite wäre ein eigenes Feature.
    if (dto.isHomepage === true && !effectiveContentId) {
      throw new BadRequestException(
        'Nur ein Menüpunkt mit Inhalts-Ziel kann die Startseite sein – weder ein externer Link noch eine Kategorie.',
      );
    }
    // Wird das Ziel eines Startseiten-Punktes auf einen externen Link
    // umgestellt, verliert er die Markierung automatisch mit – sonst
    // zeigte die Startseite ins Leere.
    const losesHomepageByTarget =
      existing.isHomepage && dto.isHomepage !== true && !effectiveContentId;

    // Die drei Ziele sind ein Entweder-oder: wird eines gesetzt, müssen die
    // beiden anderen geleert werden. Ausschlaggebend ist der tatsächlich
    // befüllte Wert, NICHT `!== undefined` – siehe Kommentar unten am
    // `update()`-Aufruf.
    const targetData = dto.contentId
      ? { contentId: dto.contentId, categoryId: null, externalUrl: null }
      : dto.categoryId
        ? { categoryId: dto.categoryId, contentId: null, externalUrl: null }
        : dto.externalUrl
          ? { externalUrl: dto.externalUrl, contentId: null, categoryId: null }
          : {};

    const item = await this.prisma.$transaction(async (tx) => {
      if (dto.isHomepage === true) {
        // Exklusivität: erst alle anderen abwählen, dann diesen setzen –
        // in einer Transaktion, damit es nie zwei Startseiten gibt.
        await tx.navigationItem.updateMany({
          where: { isHomepage: true, id: { not: itemId } },
          data: { isHomepage: false },
        });
      }
      return tx.navigationItem.update({
        where: { id: itemId },
        data: {
          ...(dto.isHomepage !== undefined && { isHomepage: dto.isHomepage }),
          ...(losesHomepageByTarget && { isHomepage: false }),
          ...(dto.label !== undefined && { label: dto.label }),
          // contentId/externalUrl bewusst als Paar behandelt: wird ein
          // Ziel gesetzt, muss das jeweils andere geleert werden, sonst
          // blieben beide gleichzeitig gesetzt. Ausschlaggebend ist der
          // tatsächlich befüllte Wert, NICHT `!== undefined`: der
          // Bearbeiten-Dialog schickt immer beide Felder und setzt das
          // ungenutzte explizit auf null – bei einer `undefined`-Prüfung
          // gewann dadurch immer die zweite Zuweisung und löschte die
          // gerade gesetzte Seite wieder (Fehlerbild: "nach dem Speichern
          // ist die hinterlegte Seite weg").
          ...targetData,
          ...(dto.categoryLayout !== undefined && {
            categoryLayout: dto.categoryLayout,
          }),
          ...(dto.appearance !== undefined && { appearance: dto.appearance }),
          ...(dto.parentId !== undefined && { parentId: dto.parentId }),
          ...(dto.openInNewTab !== undefined && {
            openInNewTab: dto.openInNewTab,
          }),
        },
        select: itemSelect,
      });
    });

    // Die Startseite ist eine site-weite, für Besucher sofort sichtbare
    // Entscheidung – die gehört in die Aktivitäten-Zeitleiste (siehe
    // knowledge-base/auth/user-activity-log.md).
    if (dto.isHomepage !== undefined && userId) {
      await this.auditLog.record({
        action: dto.isHomepage
          ? 'navigation.homepage_set'
          : 'navigation.homepage_unset',
        entityType: 'NavigationItem',
        entityId: itemId,
        userId,
        metadata: { label: item.label, slug: item.content?.slug ?? null },
      });
    }

    return item;
  }

  async removeItem(navigationId: string, itemId: string) {
    this.siteCache.invalidate('navigation.changed');
    await this.assertItemInNavigation(navigationId, itemId);
    await this.prisma.navigationItem.delete({ where: { id: itemId } });
  }

  async reorderItems(navigationId: string, dto: ReorderNavigationItemsDto) {
    this.siteCache.invalidate('navigation.changed');
    await this.assertNavigationExists(navigationId);
    const overrides = new Map(
      dto.items.map((item) => [item.id, item.parentId ?? null]),
    );
    for (const item of dto.items) {
      if (!item.parentId) continue;
      let current: string | null = item.parentId;
      const visited = new Set<string>();
      while (current) {
        if (current === item.id) {
          throw new BadRequestException(
            `Ungültige Verschiebung: zirkuläre Eltern-Kind-Beziehung für Eintrag ${item.id}.`,
          );
        }
        if (visited.has(current)) break;
        visited.add(current);
        if (overrides.has(current)) {
          current = overrides.get(current)!;
        } else {
          const row: { parentId: string | null } | null =
            await this.prisma.navigationItem.findUnique({
              where: { id: current },
              select: { parentId: true },
            });
          current = row?.parentId ?? null;
        }
      }
    }

    await this.prisma.$transaction(
      dto.items.map((item) =>
        this.prisma.navigationItem.update({
          where: { id: item.id, navigationId },
          data: { parentId: item.parentId ?? null, sortOrder: item.sortOrder },
        }),
      ),
    );
  }

  private async assertContentExists(contentId: string) {
    const exists = await this.prisma.content.findUnique({
      where: { id: contentId },
      select: { id: true, deletedAt: true },
    });
    if (!exists || exists.deletedAt) {
      throw new BadRequestException('Ziel-Inhalt nicht gefunden.');
    }
  }

  private async assertItemInNavigation(navigationId: string, itemId: string) {
    const item = await this.prisma.navigationItem.findUnique({
      where: { id: itemId },
    });
    if (!item || item.navigationId !== navigationId) {
      throw new NotFoundException(`Navigationspunkt ${itemId} nicht gefunden.`);
    }
    return item;
  }

  private async assertNoItemCycle(id: string, newParentId: string) {
    let currentId: string | null = newParentId;
    const visited = new Set<string>();
    while (currentId) {
      if (currentId === id) {
        throw new BadRequestException(
          'Ein Navigationspunkt kann nicht sein eigener Vorfahre werden.',
        );
      }
      if (visited.has(currentId)) break;
      visited.add(currentId);
      const current: { parentId: string | null } | null =
        await this.prisma.navigationItem.findUnique({
          where: { id: currentId },
          select: { parentId: true },
        });
      currentId = current?.parentId ?? null;
    }
  }
}
