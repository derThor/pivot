import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ContentStatus, Prisma } from '@strasev/database';
import { PrismaService } from '../prisma/prisma.service';
import { CreateContentDto } from './dto/create-content.dto';
import { UpdateContentDto } from './dto/update-content.dto';
import { QueryContentDto } from './dto/query-content.dto';
import { QueryContentVersionsDto } from './dto/query-content-versions.dto';

export interface CategoryRef {
  id: string;
  name: string;
  slug: string;
}

/** Flacht die Join-Tabellen-Form (`ContentCategory[]` mit verschachteltem `category`) zu einem einfachen `CategoryRef[]` ab. */
function mapContentCategories<T extends { categories: { category: CategoryRef }[] }>(
  content: T,
): Omit<T, 'categories'> & { categories: CategoryRef[] } {
  return {
    ...content,
    categories: content.categories.map((c) => c.category),
  };
}

@Injectable()
export class ContentService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: QueryContentDto) {
    const { page, pageSize, status, contentTypeId } = query;
    const where = {
      ...(status && { status }),
      ...(contentTypeId && { contentTypeId }),
    };

    const [items, total] = await Promise.all([
      this.prisma.content.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { updatedAt: 'desc' },
        include: {
          author: { select: { id: true, firstName: true, lastName: true } },
          contentType: { select: { id: true, name: true, slug: true } },
          categories: {
            include: { category: { select: { id: true, name: true, slug: true } } },
          },
        },
      }),
      this.prisma.content.count({ where }),
    ]);

    return {
      items: items.map(mapContentCategories),
      meta: { page, pageSize, total, pageCount: Math.ceil(total / pageSize) },
    };
  }

  /**
   * Postgres-Volltextsuche über Titel, Excerpt, SEO-Felder und den
   * kompletten dynamischen `data`-Inhalt (JSON als Text gecastet, damit
   * auch Rich-Text-Body & Custom-Felder durchsucht werden, unabhängig
   * vom jeweiligen ContentType-Schema).
   *
   * Baut die `tsquery` selbst aus einzelnen Präfix-Lexemen
   * (`begriff:*`) statt `websearch_to_tsquery` zu verwenden: Das Frontend
   * sucht schon ab 3 eingegebenen Zeichen ("live"), und
   * `websearch_to_tsquery` matcht nur ganze Wortstämme – "Tes" hätte das
   * Wort "Test" dadurch nie gefunden, bevor der letzte Buchstabe getippt
   * ist. Mit `:*` matcht jedes Wort, das mit dem eingegebenen Präfix
   * beginnt, was für Such-als-du-tippst-UX nötig ist.
   */
  async search(q: string, limit: number) {
    const tsQuery = q
      .trim()
      .split(/\s+/)
      .map((term) => term.replace(/[^\p{L}\p{N}]/gu, ''))
      .filter(Boolean)
      .map((term) => `${term}:*`)
      .join(' & ');
    if (!tsQuery) {
      return [];
    }

    const results = await this.prisma.$queryRaw<
      Array<{
        id: string;
        title: string;
        slug: string;
        status: ContentStatus;
        excerpt: string | null;
        updatedAt: Date;
        contentTypeName: string;
      }>
    >(Prisma.sql`
      SELECT c.id, c.title, c.slug, c.status, c.excerpt, c."updatedAt",
             ct.name AS "contentTypeName"
      FROM contents c
      JOIN content_types ct ON ct.id = c."contentTypeId"
      WHERE to_tsvector('german',
              c.title || ' ' || coalesce(c.excerpt, '') || ' ' ||
              coalesce(c."seoTitle", '') || ' ' ||
              coalesce(c."seoDescription", '') || ' ' || c.data::text
            ) @@ to_tsquery('german', ${tsQuery})
      ORDER BY ts_rank(
        to_tsvector('german',
          c.title || ' ' || coalesce(c.excerpt, '') || ' ' ||
          coalesce(c."seoTitle", '') || ' ' ||
          coalesce(c."seoDescription", '') || ' ' || c.data::text
        ),
        to_tsquery('german', ${tsQuery})
      ) DESC
      LIMIT ${limit}
    `);
    return results;
  }

  async findOne(id: string) {
    const content = await this.prisma.content.findUnique({
      where: { id },
      include: {
        author: { select: { id: true, firstName: true, lastName: true } },
        contentType: { select: { id: true, name: true, slug: true } },
        categories: {
          include: { category: { select: { id: true, name: true, slug: true } } },
        },
        versions: {
          orderBy: { createdAt: 'desc' },
          take: 10,
          include: {
            createdBy: { select: { id: true, firstName: true, lastName: true } },
          },
        },
      },
    });
    if (!content) {
      throw new NotFoundException(`Inhalt ${id} nicht gefunden.`);
    }
    return mapContentCategories(content);
  }

  async create(dto: CreateContentDto, authorId: string) {
    if (dto.categoryIds) {
      await this.assertCategoriesExist(dto.categoryIds);
    }

    const content = await this.prisma.content.create({
      data: {
        title: dto.title,
        slug: dto.slug,
        data: dto.data as Prisma.InputJsonValue,
        status: dto.status ?? ContentStatus.DRAFT,
        locale: dto.locale ?? 'de',
        excerpt: dto.excerpt,
        seoTitle: dto.seoTitle,
        seoDescription: dto.seoDescription,
        contentTypeId: dto.contentTypeId,
        authorId,
        publishedAt: dto.status === ContentStatus.PUBLISHED ? new Date() : null,
        ...(dto.categoryIds && {
          categories: {
            create: dto.categoryIds.map((categoryId) => ({ categoryId })),
          },
        }),
      },
      include: {
        categories: {
          include: { category: { select: { id: true, name: true, slug: true } } },
        },
      },
    });
    return mapContentCategories(content);
  }

  async update(id: string, dto: UpdateContentDto, editorId: string) {
    const existing = await this.findOne(id);
    const { categoryIds, ...rest } = dto;

    if (categoryIds) {
      await this.assertCategoriesExist(categoryIds);
    }

    // Vorherigen Stand als Version sichern, bevor überschrieben wird
    await this.prisma.contentVersion.create({
      data: {
        contentId: id,
        data: existing.data as Prisma.InputJsonValue,
        createdById: editorId,
      },
    });

    const becomingPublished =
      dto.status === ContentStatus.PUBLISHED &&
      existing.status !== ContentStatus.PUBLISHED;

    const content = await this.prisma.content.update({
      where: { id },
      data: {
        ...rest,
        data: dto.data as Prisma.InputJsonValue | undefined,
        ...(becomingPublished && { publishedAt: new Date() }),
        ...(categoryIds && {
          categories: {
            deleteMany: {},
            create: categoryIds.map((categoryId) => ({ categoryId })),
          },
        }),
      },
      include: {
        categories: {
          include: { category: { select: { id: true, name: true, slug: true } } },
        },
      },
    });
    return mapContentCategories(content);
  }

  private async assertCategoriesExist(categoryIds: string[]) {
    const count = await this.prisma.category.count({
      where: { id: { in: categoryIds } },
    });
    if (count !== categoryIds.length) {
      throw new BadRequestException('Mindestens eine Kategorie ist unbekannt.');
    }
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.content.delete({ where: { id } });
  }

  async findVersions(contentId: string, query: QueryContentVersionsDto) {
    await this.findOne(contentId);
    const { page, pageSize } = query;
    const where = { contentId };

    const [items, total] = await Promise.all([
      this.prisma.contentVersion.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: {
          createdBy: { select: { id: true, firstName: true, lastName: true } },
        },
      }),
      this.prisma.contentVersion.count({ where }),
    ]);

    return {
      items,
      meta: { page, pageSize, total, pageCount: Math.ceil(total / pageSize) },
    };
  }

  async rollback(contentId: string, versionId: string, editorId: string) {
    const version = await this.prisma.contentVersion.findUnique({
      where: { id: versionId },
    });
    if (!version || version.contentId !== contentId) {
      throw new NotFoundException(
        `Version ${versionId} für Inhalt ${contentId} nicht gefunden.`,
      );
    }

    const current = await this.findOne(contentId);

    // Aktuellen Stand vor dem Zurücksetzen sichern (macht den Rollback
    // selbst wieder rückgängig machbar), gleiches Muster wie update().
    await this.prisma.contentVersion.create({
      data: {
        contentId,
        data: current.data as Prisma.InputJsonValue,
        createdById: editorId,
      },
    });

    return this.prisma.content.update({
      where: { id: contentId },
      data: { data: version.data as Prisma.InputJsonValue },
    });
  }

  async removeVersion(contentId: string, versionId: string) {
    const version = await this.prisma.contentVersion.findUnique({
      where: { id: versionId },
    });
    if (!version || version.contentId !== contentId) {
      throw new NotFoundException(
        `Version ${versionId} für Inhalt ${contentId} nicht gefunden.`,
      );
    }
    await this.prisma.contentVersion.delete({ where: { id: versionId } });
  }
}
