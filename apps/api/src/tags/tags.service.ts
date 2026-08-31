import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTagDto } from './dto/create-tag.dto';
import { UpdateTagDto } from './dto/update-tag.dto';
import { QueryTagDto } from './dto/query-tag.dto';

@Injectable()
export class TagsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: QueryTagDto) {
    const { page, pageSize } = query;
    const where = { deletedAt: null };
    const [items, total] = await Promise.all([
      this.prisma.tag.findMany({
        where,
        orderBy: { name: 'asc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { _count: { select: { media: true } } },
      }),
      this.prisma.tag.count({ where }),
    ]);
    return {
      items: items.map(({ _count, ...tag }) => ({
        ...tag,
        mediaCount: _count.media,
      })),
      meta: { page, pageSize, total, pageCount: Math.ceil(total / pageSize) },
    };
  }

  /** Alle Tags ohne Pagination, für die "Alle Tags"-Übersichtsleiste
   * (Nutzervorgabe, 2026-08-16, 1:1 nach Bildvorlage) – die zeigt jeden
   * existierenden Tag als Pill, nicht nur die aktuelle Tabellenseite. */
  async findAllUnpaginated() {
    const items = await this.prisma.tag.findMany({
      where: { deletedAt: null },
      orderBy: { name: 'asc' },
      include: { _count: { select: { media: true } } },
    });
    return items.map(({ _count, ...tag }) => ({
      ...tag,
      mediaCount: _count.media,
    }));
  }

  /** Kategorien-Seite, Kachel "Tags in dieser Kategorie" (Nutzervorgabe,
   * 2026-08-31, 1:1 nach Bildvorlage) – nur Tags, die tatsächlich an
   * einem (nicht gelöschten) Beitrag dieser Kategorie hängen, mit der
   * echten Anzahl innerhalb dieser Kategorie (nicht der globalen
   * Medien-Zählung wie in `findAll()`). */
  async findByCategory(categoryId: string) {
    const tags = await this.prisma.tag.findMany({
      where: {
        deletedAt: null,
        contents: {
          some: {
            content: { deletedAt: null, categories: { some: { categoryId } } },
          },
        },
      },
      orderBy: { name: 'asc' },
      include: {
        _count: {
          select: {
            contents: {
              where: {
                content: {
                  deletedAt: null,
                  categories: { some: { categoryId } },
                },
              },
            },
          },
        },
      },
    });
    return tags.map(({ _count, ...tag }) => ({
      ...tag,
      contentCount: _count.contents,
    }));
  }

  /** Ermittelt, auf welcher Seite (bei gegebener pageSize) ein Eintrag liegt. */
  async findPage(id: string, pageSize: number) {
    const target = await this.prisma.tag.findUniqueOrThrow({ where: { id } });
    const rank = await this.prisma.tag.count({
      where: { name: { lt: target.name } },
    });
    return { page: Math.floor(rank / pageSize) + 1 };
  }

  async create(dto: CreateTagDto) {
    const existing = await this.prisma.tag.findFirst({
      where: { OR: [{ name: dto.name }, { slug: dto.slug }] },
    });
    if (existing) {
      throw new ConflictException(
        'Name oder Slug wird bereits von einem Tag verwendet.',
      );
    }
    return this.prisma.tag.create({ data: dto });
  }

  async update(id: string, dto: UpdateTagDto) {
    if (dto.name || dto.slug) {
      const existing = await this.prisma.tag.findFirst({
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
          'Name oder Slug wird bereits von einem Tag verwendet.',
        );
      }
    }
    return this.prisma.tag.update({ where: { id }, data: dto });
  }

  /** Papierkorb: Soft-Delete (Nutzervorgabe, 2026-08-18, "überall da wo man
   * löschen kann"). */
  async remove(id: string, actingUserId: string) {
    await this.prisma.tag.update({
      where: { id },
      data: { deletedAt: new Date(), deletedById: actingUserId },
    });
  }

  async restore(id: string) {
    const tag = await this.prisma.tag.findUnique({ where: { id } });
    if (!tag || !tag.deletedAt) {
      throw new NotFoundException(
        `Tag ${id} befindet sich nicht im Papierkorb.`,
      );
    }
    return this.prisma.tag.update({
      where: { id },
      data: { deletedAt: null, deletedById: null },
    });
  }

  async permanentDelete(id: string) {
    const tag = await this.prisma.tag.findUnique({ where: { id } });
    if (!tag || !tag.deletedAt) {
      throw new NotFoundException(
        `Tag ${id} befindet sich nicht im Papierkorb.`,
      );
    }
    await this.prisma.tag.delete({ where: { id } });
  }

  /** Ungepaginiert für den vereinheitlichten Papierkorb (`TrashService`),
   * der alle sechs Typen zu einer gemeinsamen Liste zusammenführt. */
  findAllTrashed() {
    return this.prisma.tag.findMany({
      where: { deletedAt: { not: null } },
      orderBy: { deletedAt: 'desc' },
      include: {
        deletedBy: { select: { id: true, firstName: true, lastName: true } },
        _count: { select: { contents: true } },
      },
    });
  }

  async findTrashed(query: QueryTagDto) {
    const { page, pageSize } = query;
    const where = { deletedAt: { not: null } };
    const [items, total] = await Promise.all([
      this.prisma.tag.findMany({
        where,
        orderBy: { name: 'asc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          _count: { select: { media: true } },
          deletedBy: { select: { id: true, firstName: true, lastName: true } },
        },
      }),
      this.prisma.tag.count({ where }),
    ]);
    return {
      items: items.map(({ _count, ...tag }) => ({
        ...tag,
        mediaCount: _count.media,
      })),
      meta: { page, pageSize, total, pageCount: Math.ceil(total / pageSize) },
    };
  }

  async findTrashedOlderThan(cutoff: Date) {
    return this.prisma.tag.findMany({
      where: { deletedAt: { not: null, lt: cutoff } },
      orderBy: { deletedAt: 'asc' },
      select: { id: true, name: true, deletedAt: true },
    });
  }
}
