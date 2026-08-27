import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { WebsitesService } from '../websites/websites.service';
import { MODULE_CATALOG, isValidModuleKey } from '../websites/module-catalog';
import { CreateMandantDto } from './dto/create-mandant.dto';
import { UpdateMandantDto } from './dto/update-mandant.dto';
import { QueryMandantDto } from './dto/query-mandant.dto';
import { AddMandantWebsiteDto } from './dto/add-mandant-website.dto';

const MANDANT_INCLUDE = {
  websites: {
    select: { id: true, name: true, domain: true, status: true },
    orderBy: { createdAt: 'asc' as const },
  },
  modules: { select: { moduleKey: true } },
};

/**
 * Mandantenfähigkeit für Master (Nutzervorgabe, 2026-08-27): ein Mandant
 * ist der eigentliche Kunde des Masters und kann mehrere Website-
 * Installationen haben. Modul-Buchung liegt hier (nicht pro Website) –
 * gilt für alle Websites eines Mandanten gleichermaßen, siehe
 * schema.prisma-Kommentar bei `Mandant`.
 */
@Injectable()
export class MandantenService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly websitesService: WebsitesService,
  ) {}

  async findAll(query: QueryMandantDto) {
    const { page, pageSize } = query;
    const [items, total] = await Promise.all([
      this.prisma.mandant.findMany({
        orderBy: { name: 'asc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: MANDANT_INCLUDE,
      }),
      this.prisma.mandant.count(),
    ]);
    return {
      items,
      meta: {
        page,
        pageSize,
        total,
        pageCount: Math.max(1, Math.ceil(total / pageSize)),
      },
    };
  }

  /** Kennzahlen für die Übersichts-Kacheln – bewusst über ALLE Mandanten,
   * unabhängig von der aktuellen Seite der paginierten Liste. */
  async getStats() {
    const [
      mandantsTotal,
      mandantsActive,
      websitesTotal,
      moduleBookingsTotal,
      withLockReasonCount,
    ] = await Promise.all([
      this.prisma.mandant.count(),
      this.prisma.mandant.count({ where: { status: 'active' } }),
      this.prisma.website.count(),
      this.prisma.mandantModule.count(),
      this.prisma.mandant.count({
        where: { status: 'locked', lockReason: { not: null } },
      }),
    ]);
    const lockedOrInactive = mandantsTotal - mandantsActive;
    return {
      mandantsTotal,
      mandantsActive,
      websitesTotal,
      moduleBookingsTotal,
      modulesAvailableCount: MODULE_CATALOG.length,
      lockedOrInactiveCount: lockedOrInactive,
      withLockReasonCount,
    };
  }

  async findOne(id: string) {
    const mandant = await this.prisma.mandant.findUnique({
      where: { id },
      include: MANDANT_INCLUDE,
    });
    if (!mandant) {
      throw new NotFoundException('Mandant nicht gefunden.');
    }
    return mandant;
  }

  /** Ein Mandant entsteht immer zusammen mit seiner ersten Website
   * (Nutzervorgabe: "bei den Mandanten gehört immer eine Webseite oder
   * mehrere dazu") – nutzt dieselbe Anlage-Logik (API-Key-Erzeugung) wie
   * die bisherige, jetzt entfernte "Projekt anlegen"-Aktion auf der
   * Webseite-Seite. */
  async create(dto: CreateMandantDto) {
    const mandant = await this.prisma.mandant.create({
      data: { name: dto.name },
    });
    await this.websitesService.create({
      name: dto.name,
      domain: dto.domain,
      mandantId: mandant.id,
    });
    return this.findOne(mandant.id);
  }

  /** Nutzervorgabe, 2026-08-27: "wenn Mandant gesperrt, muss Website
   * gesperrt werden" + "wenn inaktiv der Mandant, dann soll Website auf
   * gesperrt. wenn Mandant aktiv ist, kann ich jeden Zustand setzen" +
   * "wenn Mandant wieder auf aktiv gesetzt wird, muss Website auch aktiv
   * sein" (= technischer Website-Status "live", siehe
   * `websites/dto/update-website.dto.ts` – Website kennt kein "active").
   * Die Mitgliedschaft des Mandanten steuert damit den Website-Status in
   * beide Richtungen:
   *  - "locked"/"inactive" → alle Websites zwangsweise auf "locked".
   *  - "active" → alle (durch die Mandanten-Sperre) auf "locked"
   *    stehenden Websites zurück auf "live". Eine Website, die ein
   *    Admin bewusst auf "development" gestellt hat, bleibt unangetastet
   *    – das ist der freie "jeden Zustand setzen"-Spielraum bei aktivem
   *    Mandanten.
   * Durchsetzung real über `WebsitesService.update()` (löst dort
   * automatisch ein "Wecken" aus, die Installation reagiert sofort). */
  async update(id: string, dto: UpdateMandantDto) {
    const before = await this.findOne(id);
    await this.prisma.mandant.update({ where: { id }, data: dto });
    if (dto.status && dto.status !== before.status) {
      if (dto.status === 'locked' || dto.status === 'inactive') {
        await Promise.all(
          before.websites
            .filter((website) => website.status !== 'locked')
            .map((website) =>
              this.websitesService.update(website.id, { status: 'locked' }),
            ),
        );
      } else if (dto.status === 'active') {
        await Promise.all(
          before.websites
            .filter((website) => website.status === 'locked')
            .map((website) =>
              this.websitesService.update(website.id, { status: 'live' }),
            ),
        );
      }
    }
    return this.findOne(id);
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.mandant.delete({ where: { id } });
  }

  /** "Domain hinzufügen" auf der Mandant-Detailseite – weitere Website
   * für einen bereits bestehenden Mandanten. */
  async addWebsite(mandantId: string, dto: AddMandantWebsiteDto) {
    const mandant = await this.findOne(mandantId);
    await this.websitesService.create({
      name: mandant.name,
      domain: dto.domain,
      mandantId,
    });
    return this.findOne(mandantId);
  }

  /** Fester, codeseitiger Modul-Katalog – nie DB-basiert, siehe
   * websites/module-catalog.ts. */
  getModuleCatalog() {
    return MODULE_CATALOG;
  }

  /** Ersetzt den kompletten Buchungsstand eines Mandanten (einfacher als
   * einzelne add/remove-Endpunkte, passt zu einer Checkbox-/Toggle-Liste
   * im Frontend). Jeder Key wird gegen den Katalog validiert – ein
   * "Neu"-Button für Module gibt es bewusst nicht (Nutzervorgabe). */
  async updateModules(
    id: string,
    moduleKeys: string[],
    actingUserId: string,
  ): Promise<void> {
    await this.findOne(id);
    const uniqueKeys = [...new Set(moduleKeys)];
    for (const key of uniqueKeys) {
      if (!isValidModuleKey(key)) {
        throw new BadRequestException(`Unbekanntes Modul: "${key}".`);
      }
    }
    await this.prisma.$transaction([
      this.prisma.mandantModule.deleteMany({ where: { mandantId: id } }),
      this.prisma.mandantModule.createMany({
        data: uniqueKeys.map((moduleKey) => ({
          mandantId: id,
          moduleKey,
          bookedById: actingUserId,
        })),
      }),
    ]);
  }
}
