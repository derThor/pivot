import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { ContentStatus, Prisma } from '@pivot/database';
import { PrismaService } from '../prisma/prisma.service';
import { WebhooksService } from '../webhooks/webhooks.service';
import { CreateContentDto } from './dto/create-content.dto';
import { UpdateContentDto } from './dto/update-content.dto';
import { QueryContentDto } from './dto/query-content.dto';
import { QueryContentVersionsDto } from './dto/query-content-versions.dto';
import { CreatePreviewLinkDto } from './dto/create-preview-link.dto';
import { UpdatePreviewLinkDto } from './dto/update-preview-link.dto';
import { QueryPreviewLinksDto } from './dto/query-preview-links.dto';

export interface CategoryRef {
  id: string;
  name: string;
  slug: string;
}

/** Sperren älter als das hier gelten als abgelaufen (verwaiste Sperre nach Tab-Crash o.ä.). */
const CONTENT_LOCK_TTL_MS = 2 * 60 * 1000;

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
  constructor(
    private readonly prisma: PrismaService,
    private readonly webhooksService: WebhooksService,
  ) {}

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
  async search(q: string, limit: number, skip: number = 0) {
    const tsQuery = this.toTsQuery(q);
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
      OFFSET ${skip}
    `);
    return results;
  }

  /** Gesamtzahl der Treffer für `search()` (dieselbe Bedingung, ohne
   * LIMIT/OFFSET/ORDER) – für die Pagination der Detailsuche-Ergebnisseite
   * (siehe SearchService.searchPaged). */
  async searchCount(q: string) {
    const tsQuery = this.toTsQuery(q);
    if (!tsQuery) return 0;

    const rows = await this.prisma.$queryRaw<Array<{ count: bigint }>>(Prisma.sql`
      SELECT COUNT(*)::bigint AS count
      FROM contents c
      JOIN content_types ct ON ct.id = c."contentTypeId"
      WHERE to_tsvector('german',
              c.title || ' ' || coalesce(c.excerpt, '') || ' ' ||
              coalesce(c."seoTitle", '') || ' ' ||
              coalesce(c."seoDescription", '') || ' ' || c.data::text
            ) @@ to_tsquery('german', ${tsQuery})
    `);
    return Number(rows[0]?.count ?? 0);
  }

  private toTsQuery(q: string) {
    return q
      .trim()
      .split(/\s+/)
      .map((term) => term.replace(/[^\p{L}\p{N}]/gu, ''))
      .filter(Boolean)
      .map((term) => `${term}:*`)
      .join(' & ');
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
        lockedBy: { select: { id: true, firstName: true, lastName: true } },
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
    if (dto.status === ContentStatus.SCHEDULED && !dto.scheduledFor) {
      throw new BadRequestException(
        'Für einen geplanten Inhalt muss ein Veröffentlichungszeitpunkt gesetzt sein.',
      );
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
        canonicalUrl: dto.canonicalUrl,
        ogTitle: dto.ogTitle,
        ogDescription: dto.ogDescription,
        ogImageUrl: dto.ogImageUrl,
        twitterCard: dto.twitterCard,
        robotsIndex: dto.robotsIndex ?? true,
        robotsFollow: dto.robotsFollow ?? true,
        scheduledFor: dto.scheduledFor ? new Date(dto.scheduledFor) : null,
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

    if (content.status === ContentStatus.PUBLISHED) {
      void this.webhooksService.dispatch('content.published', {
        id: content.id,
        title: content.title,
        slug: content.slug,
      });
    }

    return mapContentCategories(content);
  }

  async update(id: string, dto: UpdateContentDto, editorId: string) {
    const existing = await this.findOne(id);
    const { categoryIds, scheduledFor, ...rest } = dto;

    if (categoryIds) {
      await this.assertCategoriesExist(categoryIds);
    }

    const effectiveStatus = dto.status ?? existing.status;
    const effectiveScheduledFor =
      scheduledFor !== undefined ? scheduledFor : existing.scheduledFor;
    if (effectiveStatus === ContentStatus.SCHEDULED && !effectiveScheduledFor) {
      throw new BadRequestException(
        'Für einen geplanten Inhalt muss ein Veröffentlichungszeitpunkt gesetzt sein.',
      );
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
        ...(scheduledFor !== undefined && {
          scheduledFor: scheduledFor ? new Date(scheduledFor) : null,
        }),
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

    void this.webhooksService.dispatch('content.updated', {
      id: content.id,
      title: content.title,
      slug: content.slug,
      status: content.status,
    });
    if (becomingPublished) {
      void this.webhooksService.dispatch('content.published', {
        id: content.id,
        title: content.title,
        slug: content.slug,
      });
    }

    return mapContentCategories(content);
  }

  /**
   * Wird periodisch vom `ContentSchedulerService` aufgerufen. Direktes
   * `updateMany` statt `update()` pro Eintrag: eine reine Status-
   * Umschaltung ohne inhaltliche Änderung braucht keinen
   * Versions-Snapshot (der bildet Datenänderungen ab, nicht
   * Statuswechsel) und keinen handelnden Editor.
   */
  async publishDueScheduled(): Promise<number> {
    const now = new Date();
    const due = await this.prisma.content.findMany({
      where: { status: ContentStatus.SCHEDULED, scheduledFor: { lte: now } },
      select: { id: true, title: true, slug: true },
    });
    if (due.length === 0) return 0;

    await this.prisma.content.updateMany({
      where: { id: { in: due.map((content) => content.id) } },
      data: { status: ContentStatus.PUBLISHED, publishedAt: now },
    });

    for (const content of due) {
      void this.webhooksService.dispatch('content.published', {
        id: content.id,
        title: content.title,
        slug: content.slug,
      });
    }

    return due.length;
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

  /**
   * Weiche Bearbeitungssperre: verhindert, dass zwei Redakteure denselben
   * Inhalt gleichzeitig bearbeiten und sich gegenseitig überschreiben.
   * Läuft nach `LOCK_TTL_MS` automatisch ab (kein Freischalt-Endpoint für
   * abgestürzte Tabs nötig) – der Editor im Frontend ruft diesen Endpoint
   * per Heartbeat erneut auf, solange aktiv bearbeitet wird, wodurch sich
   * die Sperre verlängert.
   */
  async lock(id: string, userId: string) {
    const content = await this.prisma.content.findUnique({
      where: { id },
      select: { id: true, lockedById: true, lockedAt: true },
    });
    if (!content) {
      throw new NotFoundException(`Inhalt ${id} nicht gefunden.`);
    }

    const isExpired =
      !content.lockedAt ||
      Date.now() - content.lockedAt.getTime() > CONTENT_LOCK_TTL_MS;

    if (content.lockedById && content.lockedById !== userId && !isExpired) {
      const holder = await this.prisma.user.findUnique({
        where: { id: content.lockedById },
        select: { id: true, firstName: true, lastName: true },
      });
      throw new ConflictException({
        message: 'Dieser Inhalt wird gerade von einer anderen Person bearbeitet.',
        lockedBy: holder,
        lockedAt: content.lockedAt,
      });
    }

    const updated = await this.prisma.content.update({
      where: { id },
      data: { lockedById: userId, lockedAt: new Date() },
      select: {
        lockedAt: true,
        lockedBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });
    return updated;
  }

  async unlock(id: string, userId: string, canForceUnlock: boolean) {
    const content = await this.prisma.content.findUnique({
      where: { id },
      select: { id: true, lockedById: true },
    });
    if (!content) {
      throw new NotFoundException(`Inhalt ${id} nicht gefunden.`);
    }
    if (
      content.lockedById &&
      content.lockedById !== userId &&
      !canForceUnlock
    ) {
      throw new ForbiddenException(
        'Nur die sperrende Person oder ein Admin kann diese Sperre aufheben.',
      );
    }
    await this.prisma.content.update({
      where: { id },
      data: { lockedById: null, lockedAt: null },
    });
  }

  /**
   * Erzeugt einen signierten, zeitlich begrenzten Vorschau-Link – z.B.
   * um einen noch nicht veröffentlichten Entwurf mit Stakeholdern ohne
   * Dashboard-Zugang zu teilen. Anders als Refresh-/E-Mail-Verifikations-/
   * Passwort-Reset-Tokens wird hier der Rohwert dauerhaft gespeichert
   * (nicht nur sein Hash): Vorschau-Links sollen jederzeit erneut kopiert
   * und in ihrer Gültigkeit verlängert werden können, was mit einem
   * Einweg-Hash nicht möglich wäre. Der Zugriff auf den Rohwert ist über
   * dieselbe `content:read`-Berechtigung geschützt wie das Anlegen/
   * Auflisten selbst.
   */
  async createPreviewLink(
    contentId: string,
    userId: string,
    dto: CreatePreviewLinkDto,
  ) {
    await this.findOne(contentId);
    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(
      Date.now() + dto.expiresInHours * 60 * 60 * 1000,
    );

    const record = await this.prisma.contentPreviewToken.create({
      data: {
        token,
        contentId,
        createdById: userId,
        expiresAt,
      },
    });

    return { id: record.id, token, expiresAt: record.expiresAt };
  }

  async findPreviewLinks(contentId: string) {
    await this.findOne(contentId);
    return this.prisma.contentPreviewToken.findMany({
      where: { contentId, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        token: true,
        expiresAt: true,
        createdAt: true,
        createdBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });
  }

  /** Übersicht über alle aktiven Vorschau-Links, inhaltsübergreifend. */
  async findAllPreviewLinks(query: QueryPreviewLinksDto) {
    const { page, pageSize } = query;
    const where = { expiresAt: { gt: new Date() } };
    const [items, total] = await Promise.all([
      this.prisma.contentPreviewToken.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          token: true,
          expiresAt: true,
          createdAt: true,
          content: { select: { id: true, title: true } },
          createdBy: { select: { id: true, firstName: true, lastName: true } },
        },
      }),
      this.prisma.contentPreviewToken.count({ where }),
    ]);
    return {
      items,
      meta: { page, pageSize, total, pageCount: Math.ceil(total / pageSize) },
    };
  }

  /** Ermittelt, auf welcher Seite (bei gegebener pageSize) ein Vorschau-Link liegt. */
  async findPreviewLinkPage(id: string, pageSize: number) {
    const target = await this.prisma.contentPreviewToken.findUniqueOrThrow({
      where: { id },
    });
    const rank = await this.prisma.contentPreviewToken.count({
      where: {
        expiresAt: { gt: new Date() },
        createdAt: { gt: target.createdAt },
      },
    });
    return { page: Math.floor(rank / pageSize) + 1 };
  }

  async updatePreviewLink(
    contentId: string,
    linkId: string,
    dto: UpdatePreviewLinkDto,
  ) {
    const link = await this.prisma.contentPreviewToken.findUnique({
      where: { id: linkId },
    });
    if (!link || link.contentId !== contentId) {
      throw new NotFoundException('Vorschau-Link nicht gefunden.');
    }
    return this.prisma.contentPreviewToken.update({
      where: { id: linkId },
      data: {
        expiresAt: new Date(Date.now() + dto.expiresInHours * 60 * 60 * 1000),
      },
      select: {
        id: true,
        token: true,
        expiresAt: true,
        createdAt: true,
        createdBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });
  }

  async revokePreviewLink(contentId: string, linkId: string) {
    const link = await this.prisma.contentPreviewToken.findUnique({
      where: { id: linkId },
    });
    if (!link || link.contentId !== contentId) {
      throw new NotFoundException('Vorschau-Link nicht gefunden.');
    }
    await this.prisma.contentPreviewToken.delete({ where: { id: linkId } });
  }

  /** Öffentlich (kein Login nötig) – validiert den Token und liefert den Inhalt unabhängig vom Status. */
  async findByPreviewToken(token: string) {
    const link = await this.prisma.contentPreviewToken.findUnique({
      where: { token },
      include: {
        content: {
          include: {
            contentType: { select: { id: true, name: true, slug: true } },
          },
        },
      },
    });
    if (!link || link.expiresAt.getTime() < Date.now()) {
      throw new NotFoundException(
        'Dieser Vorschau-Link ist ungültig oder abgelaufen.',
      );
    }
    return link.content;
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
