import { Injectable, NotFoundException } from '@nestjs/common';
import { ContentStatus, Prisma } from '@strasev/database';
import { PrismaService } from '../prisma/prisma.service';
import { CreateContentDto } from './dto/create-content.dto';
import { UpdateContentDto } from './dto/update-content.dto';
import { QueryContentDto } from './dto/query-content.dto';

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
          author: { select: { id: true, name: true } },
          contentType: { select: { id: true, name: true, slug: true } },
        },
      }),
      this.prisma.content.count({ where }),
    ]);

    return {
      items,
      meta: { page, pageSize, total, pageCount: Math.ceil(total / pageSize) },
    };
  }

  async findOne(id: string) {
    const content = await this.prisma.content.findUnique({
      where: { id },
      include: {
        author: { select: { id: true, name: true } },
        contentType: { select: { id: true, name: true, slug: true } },
        versions: { orderBy: { createdAt: 'desc' }, take: 10 },
      },
    });
    if (!content) {
      throw new NotFoundException(`Inhalt ${id} nicht gefunden.`);
    }
    return content;
  }

  create(dto: CreateContentDto, authorId: string) {
    return this.prisma.content.create({
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
      },
    });
  }

  async update(id: string, dto: UpdateContentDto, editorId: string) {
    const existing = await this.findOne(id);

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

    return this.prisma.content.update({
      where: { id },
      data: {
        ...dto,
        data: dto.data as Prisma.InputJsonValue | undefined,
        ...(becomingPublished && { publishedAt: new Date() }),
      },
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.content.delete({ where: { id } });
  }
}
