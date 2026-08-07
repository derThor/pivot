import { ConflictException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTagDto } from './dto/create-tag.dto';
import { UpdateTagDto } from './dto/update-tag.dto';
import { QueryTagDto } from './dto/query-tag.dto';

@Injectable()
export class TagsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: QueryTagDto) {
    const { page, pageSize } = query;
    const [items, total] = await Promise.all([
      this.prisma.tag.findMany({
        orderBy: { name: 'asc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.tag.count(),
    ]);
    return {
      items,
      meta: { page, pageSize, total, pageCount: Math.ceil(total / pageSize) },
    };
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

  async remove(id: string) {
    await this.prisma.tag.delete({ where: { id } });
  }
}
