import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
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
  sortOrder: true,
  parentId: true,
  contentId: true,
  content: { select: { id: true, title: true, slug: true, status: true } },
} as const;

@Injectable()
export class NavigationService {
  constructor(private readonly prisma: PrismaService) {}

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

  async create(dto: CreateNavigationDto) {
    await this.assertSlugUnique(dto.slug);
    return this.prisma.navigation.create({ data: dto });
  }

  async update(id: string, dto: UpdateNavigationDto) {
    if (dto.slug) {
      await this.assertSlugUnique(dto.slug, id);
    }
    await this.assertNavigationExists(id);
    return this.prisma.navigation.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
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

  private assertExactlyOneTarget(dto: {
    contentId?: string | null;
    externalUrl?: string | null;
  }) {
    const hasContent = Boolean(dto.contentId);
    const hasExternal = Boolean(dto.externalUrl);
    if (hasContent === hasExternal) {
      throw new BadRequestException(
        'Ein Navigationspunkt braucht genau ein Ziel: entweder einen Inhalt oder eine externe URL.',
      );
    }
  }

  async createItem(navigationId: string, dto: CreateNavigationItemDto) {
    await this.assertNavigationExists(navigationId);
    this.assertExactlyOneTarget(dto);
    if (dto.contentId) {
      await this.assertContentExists(dto.contentId);
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
        externalUrl: dto.externalUrl ?? null,
        parentId: dto.parentId ?? null,
        openInNewTab: dto.openInNewTab ?? false,
        sortOrder: (maxSortOrder._max.sortOrder ?? -1) + 1,
      },
      select: itemSelect,
    });
  }

  async updateItem(
    navigationId: string,
    itemId: string,
    dto: UpdateNavigationItemDto,
  ) {
    const existing = await this.assertItemInNavigation(navigationId, itemId);
    const effectiveContentId =
      dto.contentId !== undefined ? dto.contentId : existing.contentId;
    const effectiveExternalUrl =
      dto.externalUrl !== undefined ? dto.externalUrl : existing.externalUrl;
    this.assertExactlyOneTarget({
      contentId: effectiveContentId,
      externalUrl: effectiveExternalUrl,
    });
    if (dto.contentId) {
      await this.assertContentExists(dto.contentId);
    }
    if (dto.parentId !== undefined && dto.parentId) {
      await this.assertItemInNavigation(navigationId, dto.parentId);
      await this.assertNoItemCycle(itemId, dto.parentId);
    }
    return this.prisma.navigationItem.update({
      where: { id: itemId },
      data: {
        ...(dto.label !== undefined && { label: dto.label }),
        // contentId/externalUrl bewusst als Paar behandelt: sobald eines
        // explizit gesetzt wird, muss das jeweils andere geleert werden,
        // sonst blieben beide gleichzeitig gesetzt.
        ...(dto.contentId !== undefined && {
          contentId: dto.contentId,
          externalUrl: null,
        }),
        ...(dto.externalUrl !== undefined && {
          externalUrl: dto.externalUrl,
          contentId: null,
        }),
        ...(dto.parentId !== undefined && { parentId: dto.parentId }),
        ...(dto.openInNewTab !== undefined && {
          openInNewTab: dto.openInNewTab,
        }),
      },
      select: itemSelect,
    });
  }

  async removeItem(navigationId: string, itemId: string) {
    await this.assertItemInNavigation(navigationId, itemId);
    await this.prisma.navigationItem.delete({ where: { id: itemId } });
  }

  async reorderItems(navigationId: string, dto: ReorderNavigationItemsDto) {
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
