import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ContentStatus } from '@pivot/database';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { QueryCategoryDto } from './dto/query-category.dto';

// RSS 2.0 verlangt kein XML-Escaping-Framework – vier Zeichen reichen für
// gültiges XML aus Nutzer-eingegebenem Titel/Auszug (Category.name/
// description, Content.title/excerpt).
function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function toRfc822(date: Date): string {
  return date.toUTCString();
}

const FEED_ITEM_LIMIT = 20;

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: QueryCategoryDto) {
    const { page, pageSize } = query;
    const where = { deletedAt: null };
    const [items, total] = await Promise.all([
      this.prisma.category.findMany({
        where,
        orderBy: { name: 'asc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { _count: { select: { contents: true } } },
      }),
      this.prisma.category.count({ where }),
    ]);
    return {
      items: items.map(({ _count, ...category }) => ({
        ...category,
        contentCount: _count.contents,
      })),
      meta: { page, pageSize, total, pageCount: Math.ceil(total / pageSize) },
    };
  }

  /** Kategorien-Seite, Kopfkachel der ausgewählten Kategorie (Nutzervorgabe,
   * 2026-08-31, 1:1 nach Bildvorlage) – "BEITRÄGE"/"LIVE" sind echte
   * Zählungen, keine erfundenen Kennzahlen (Aufrufe wurden bewusst
   * weggelassen, siehe knowledge-base). */
  async findOne(id: string) {
    const category = await this.prisma.category.findUnique({ where: { id } });
    if (!category || category.deletedAt) {
      throw new NotFoundException(`Kategorie ${id} nicht gefunden.`);
    }
    const [contentCount, liveCount] = await Promise.all([
      this.prisma.content.count({
        where: { deletedAt: null, categories: { some: { categoryId: id } } },
      }),
      this.prisma.content.count({
        where: {
          deletedAt: null,
          status: ContentStatus.PUBLISHED,
          categories: { some: { categoryId: id } },
        },
      }),
    ]);
    return { ...category, contentCount, liveCount };
  }

  /** Kategorien-Seite, Schalter "RSS-Feed anbieten" (Nutzervorgabe,
   * 2026-08-31) – echter RSS-2.0-Feed aus den zuletzt veröffentlichten
   * Beiträgen dieser Kategorie. `null` = Kategorie unbekannt/gelöscht
   * oder Feed deaktiviert, Controller antwortet dann mit 404.
   *
   * Bekannte Lücke: `<link>` fehlt bei Beiträgen ohne `canonicalUrl` –
   * es gibt aktuell keine echte Basis-URL für eine öffentlich
   * ausgelieferte Seite (die öffentliche Website selbst ist noch nicht
   * gebaut, siehe knowledge-base). Kein erfundener Domain-Platzhalter,
   * `<guid isPermaLink="false">` bleibt als eindeutiger Bezug bestehen. */
  async generateFeed(id: string): Promise<string | null> {
    const category = await this.prisma.category.findUnique({ where: { id } });
    if (!category || category.deletedAt || !category.rssEnabled) return null;

    const items = await this.prisma.content.findMany({
      where: {
        deletedAt: null,
        status: ContentStatus.PUBLISHED,
        categories: { some: { categoryId: id } },
      },
      orderBy: { publishedAt: 'desc' },
      take: FEED_ITEM_LIMIT,
      select: {
        id: true,
        title: true,
        excerpt: true,
        canonicalUrl: true,
        publishedAt: true,
      },
    });

    const itemsXml = items
      .map((item) => {
        const link = item.canonicalUrl
          ? `<link>${escapeXml(item.canonicalUrl)}</link>`
          : '';
        return `    <item>
      <title>${escapeXml(item.title)}</title>
      ${item.excerpt ? `<description>${escapeXml(item.excerpt)}</description>` : ''}
      <guid isPermaLink="false">${item.id}</guid>
      ${link}
      <pubDate>${toRfc822(item.publishedAt ?? new Date())}</pubDate>
    </item>`;
      })
      .join('\n');

    return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>${escapeXml(category.name)}</title>
    ${category.description ? `<description>${escapeXml(category.description)}</description>` : ''}
    <lastBuildDate>${toRfc822(new Date())}</lastBuildDate>
${itemsXml}
  </channel>
</rss>`;
  }

  /** Ermittelt, auf welcher Seite (bei gegebener pageSize) ein Eintrag liegt. */
  async findPage(id: string, pageSize: number) {
    const target = await this.prisma.category.findUniqueOrThrow({
      where: { id },
    });
    const rank = await this.prisma.category.count({
      where: { name: { lt: target.name } },
    });
    return { page: Math.floor(rank / pageSize) + 1 };
  }

  async create(dto: CreateCategoryDto) {
    const existing = await this.prisma.category.findFirst({
      where: { OR: [{ name: dto.name }, { slug: dto.slug }] },
    });
    if (existing) {
      throw new ConflictException(
        'Name oder Slug wird bereits von einer Kategorie verwendet.',
      );
    }
    return this.prisma.category.create({ data: dto });
  }

  async update(id: string, dto: UpdateCategoryDto) {
    if (dto.name || dto.slug) {
      const existing = await this.prisma.category.findFirst({
        where: {
          id: { not: id },
          OR: [
            ...(dto.name ? [{ name: dto.name }] : []),
            ...(dto.slug ? [{ slug: dto.slug }] : []),
          ],
        },
      });
      if (existing) {
        throw new ConflictException(
          'Name oder Slug wird bereits von einer Kategorie verwendet.',
        );
      }
    }
    return this.prisma.category.update({ where: { id }, data: dto });
  }

  /** Papierkorb: Soft-Delete (Nutzervorgabe, 2026-08-18, "überall da wo man
   * löschen kann"). */
  async remove(id: string, actingUserId: string) {
    await this.prisma.category.update({
      where: { id },
      data: { deletedAt: new Date(), deletedById: actingUserId },
    });
  }

  async restore(id: string) {
    const category = await this.prisma.category.findUnique({ where: { id } });
    if (!category || !category.deletedAt) {
      throw new NotFoundException(
        `Kategorie ${id} befindet sich nicht im Papierkorb.`,
      );
    }
    return this.prisma.category.update({
      where: { id },
      data: { deletedAt: null, deletedById: null },
    });
  }

  async permanentDelete(id: string) {
    const category = await this.prisma.category.findUnique({ where: { id } });
    if (!category || !category.deletedAt) {
      throw new NotFoundException(
        `Kategorie ${id} befindet sich nicht im Papierkorb.`,
      );
    }
    await this.prisma.category.delete({ where: { id } });
  }

  /** Ungepaginiert für den vereinheitlichten Papierkorb (`TrashService`),
   * der alle sechs Typen zu einer gemeinsamen Liste zusammenführt. */
  findAllTrashed() {
    return this.prisma.category.findMany({
      where: { deletedAt: { not: null } },
      orderBy: { deletedAt: 'desc' },
      include: {
        deletedBy: { select: { id: true, firstName: true, lastName: true } },
        _count: { select: { contents: true } },
      },
    });
  }

  async findTrashed(query: QueryCategoryDto) {
    const { page, pageSize } = query;
    const where = { deletedAt: { not: null } };
    const [items, total] = await Promise.all([
      this.prisma.category.findMany({
        where,
        orderBy: { name: 'asc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          deletedBy: { select: { id: true, firstName: true, lastName: true } },
        },
      }),
      this.prisma.category.count({ where }),
    ]);
    return {
      items,
      meta: { page, pageSize, total, pageCount: Math.ceil(total / pageSize) },
    };
  }

  async findTrashedOlderThan(cutoff: Date) {
    return this.prisma.category.findMany({
      where: { deletedAt: { not: null, lt: cutoff } },
      orderBy: { deletedAt: 'asc' },
      select: { id: true, name: true, deletedAt: true },
    });
  }
}
