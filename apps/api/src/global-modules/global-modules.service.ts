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
    const where = {
      deletedAt: null,
      ...(query.moduleTypeId && { moduleTypeId: query.moduleTypeId }),
    };
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
        deletedAt: null,
      },
    });
    return { page: Math.floor(rank / pageSize) + 1 };
  }

  async findOne(id: string) {
    const globalModule = await this.prisma.globalModule.findUnique({
      where: { id },
      include: { moduleType: { select: { id: true, name: true, icon: true } } },
    });
    if (!globalModule || globalModule.deletedAt) {
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

  // Globale Module haben keine eigene Permission-Ressource im Katalog –
  // welches Recht greift, hängt vom referenzierten Modul-Typ ab (dessen
  // `slug` deckt sich bewusst mit den Katalog-Ressourcen `gallery`/`faq`,
  // siehe packages/database/prisma/seed.ts). Alle anderen Modul-Typen sind
  // nur als Inline-Baustein in Content vorgesehen (nie als globales Modul,
  // die Dashboard-UI bietet dafür keinen Weg) – als Fallback greift dort
  // `settings`, damit ein API-Aufruf trotzdem plausibel gegated bleibt.
  async resolveResource(moduleTypeId: string): Promise<string> {
    const moduleType = await this.prisma.moduleType.findUnique({
      where: { id: moduleTypeId },
      select: { slug: true },
    });
    if (!moduleType) {
      throw new BadRequestException('Modul-Typ nicht gefunden.');
    }
    return ['gallery', 'faq'].includes(moduleType.slug)
      ? moduleType.slug
      : 'settings';
  }

  async resolveResourceForModule(id: string): Promise<string> {
    const globalModule = await this.prisma.globalModule.findUnique({
      where: { id },
      select: { moduleTypeId: true },
    });
    if (!globalModule) {
      throw new NotFoundException(`Globales Modul ${id} nicht gefunden.`);
    }
    return this.resolveResource(globalModule.moduleTypeId);
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

  /** Papierkorb: Soft-Delete (Nutzervorgabe, 2026-08-18, "überall da wo man
   * löschen kann") – gilt gleichermaßen für Galerien und FAQs, da beide
   * dieses Modell teilen. */
  async remove(id: string, actingUserId: string) {
    await this.assertExists(id);
    await this.prisma.globalModule.update({
      where: { id },
      data: { deletedAt: new Date(), deletedById: actingUserId },
    });
  }

  async restore(id: string) {
    const globalModule = await this.prisma.globalModule.findUnique({
      where: { id },
    });
    if (!globalModule || !globalModule.deletedAt) {
      throw new NotFoundException(
        `Globales Modul ${id} befindet sich nicht im Papierkorb.`,
      );
    }
    return this.prisma.globalModule.update({
      where: { id },
      data: { deletedAt: null, deletedById: null },
    });
  }

  async permanentDelete(id: string) {
    const globalModule = await this.prisma.globalModule.findUnique({
      where: { id },
    });
    if (!globalModule || !globalModule.deletedAt) {
      throw new NotFoundException(
        `Globales Modul ${id} befindet sich nicht im Papierkorb.`,
      );
    }
    await this.prisma.globalModule.delete({ where: { id } });
  }

  findTrashed() {
    return this.prisma.globalModule.findMany({
      where: { deletedAt: { not: null } },
      orderBy: { deletedAt: 'desc' },
      include: {
        moduleType: { select: { id: true, name: true, icon: true, slug: true } },
        deletedBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });
  }

  findTrashedOlderThan(cutoff: Date) {
    return this.prisma.globalModule.findMany({
      where: { deletedAt: { not: null, lt: cutoff } },
      orderBy: { deletedAt: 'asc' },
      select: { id: true, name: true, deletedAt: true },
    });
  }

  private async assertExists(id: string) {
    const exists = await this.prisma.globalModule.findUnique({
      where: { id },
      select: { id: true, deletedAt: true },
    });
    if (!exists || exists.deletedAt) {
      throw new NotFoundException(`Globales Modul ${id} nicht gefunden.`);
    }
  }
}
