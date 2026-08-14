import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@pivot/database';
import { PrismaService } from '../prisma/prisma.service';
import { CreateGlobalModuleDto } from './dto/create-global-module.dto';
import { UpdateGlobalModuleDto } from './dto/update-global-module.dto';
import { QueryGlobalModuleDto } from './dto/query-global-module.dto';

@Injectable()
export class GlobalModulesService {
  constructor(private readonly prisma: PrismaService) {}

  // Ohne `page` (Standardfall für Block-Editor/Content-Auflösung): flaches
  // Array wie bisher, optional nach `moduleTypeId` gefiltert. Mit `page`
  // (Galerien-/FAQ-Übersicht): paginiertes `{items, meta}`, siehe
  // QueryGlobalModuleDto.
  findAll(query: QueryGlobalModuleDto = new QueryGlobalModuleDto()) {
    const where = query.moduleTypeId
      ? { moduleTypeId: query.moduleTypeId }
      : undefined;
    const include = {
      moduleType: { select: { id: true, name: true, icon: true } },
    } as const;

    if (query.page == null) {
      return this.prisma.globalModule.findMany({
        where,
        orderBy: { name: 'asc' },
        include,
      });
    }

    const { page, pageSize } = query;
    return Promise.all([
      this.prisma.globalModule.findMany({
        where,
        orderBy: { name: 'asc' },
        include,
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.globalModule.count({ where }),
    ]).then(([items, total]) => ({
      items,
      meta: { page, pageSize, total, pageCount: Math.ceil(total / pageSize) },
    }));
  }

  /** Ermittelt, auf welcher Seite (bei gegebener pageSize) ein Eintrag
   * innerhalb seines eigenen Modul-Typs (FAQ/Galerie getrennt) liegt –
   * von der globalen Suche genutzt, siehe CategoriesService.findPage für
   * dasselbe Muster. */
  async findPage(id: string, pageSize: number) {
    const target = await this.prisma.globalModule.findUniqueOrThrow({
      where: { id },
    });
    const rank = await this.prisma.globalModule.count({
      where: {
        moduleTypeId: target.moduleTypeId,
        name: { lt: target.name },
      },
    });
    return { page: Math.floor(rank / pageSize) + 1 };
  }

  async findOne(id: string) {
    const globalModule = await this.prisma.globalModule.findUnique({
      where: { id },
      include: { moduleType: { select: { id: true, name: true, icon: true } } },
    });
    if (!globalModule) {
      throw new NotFoundException(`Globales Modul ${id} nicht gefunden.`);
    }
    return globalModule;
  }

  private async assertModuleTypeExists(moduleTypeId: string) {
    const exists = await this.prisma.moduleType.findUnique({
      where: { id: moduleTypeId },
      select: { id: true },
    });
    if (!exists) {
      throw new BadRequestException('Modul-Typ nicht gefunden.');
    }
  }

  async create(dto: CreateGlobalModuleDto) {
    await this.assertModuleTypeExists(dto.moduleTypeId);
    const created = await this.prisma.globalModule.create({
      data: {
        ...dto,
        values: dto.values as Prisma.InputJsonValue,
        settings: dto.settings as Prisma.InputJsonValue | undefined,
      },
    });
    return this.findOne(created.id);
  }

  async update(id: string, dto: UpdateGlobalModuleDto) {
    await this.assertExists(id);
    await this.prisma.globalModule.update({
      where: { id },
      data: {
        ...dto,
        values: dto.values as Prisma.InputJsonValue | undefined,
        settings: dto.settings as Prisma.InputJsonValue | undefined,
      },
    });
    return this.findOne(id);
  }

  async remove(id: string) {
    await this.assertExists(id);
    await this.prisma.globalModule.delete({ where: { id } });
  }

  private async assertExists(id: string) {
    const exists = await this.prisma.globalModule.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!exists) {
      throw new NotFoundException(`Globales Modul ${id} nicht gefunden.`);
    }
  }
}
