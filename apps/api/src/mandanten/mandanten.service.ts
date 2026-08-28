import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { WebsitesService } from '../websites/websites.service';
import {
  MODULE_CATALOG,
  isValidModuleKey,
  isValidFeatureKey,
  getAllFeatureKeys,
} from '../websites/module-catalog';
import { CreateMandantDto } from './dto/create-mandant.dto';
import { UpdateMandantDto } from './dto/update-mandant.dto';
import { QueryMandantDto } from './dto/query-mandant.dto';
import { AddMandantWebsiteDto } from './dto/add-mandant-website.dto';

const MANDANT_INCLUDE = {
  websites: {
    select: { id: true, name: true, domain: true, status: true },
    orderBy: { createdAt: 'asc' as const },
  },
  modules: {
    select: { moduleKey: true, enabled: true, enabledFeatures: true },
  },
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
    // Datenschutz-als-Modul (Nutzervorgabe, 2026-08-28): "Modul bei neuen
    // Mandanten vorinstallieren" – Module mit `autoInstallForNewMandants`
    // werden direkt beim Anlegen mitgebucht, komplett aktiv.
    const autoInstall = await this.prisma.moduleSettings.findMany({
      where: { autoInstallForNewMandants: true },
    });
    for (const setting of autoInstall) {
      if (!isValidModuleKey(setting.moduleKey)) continue;
      await this.prisma.mandantModule.create({
        data: {
          mandantId: mandant.id,
          moduleKey: setting.moduleKey,
          enabledFeatures: getAllFeatureKeys(setting.moduleKey),
        },
      });
    }
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

  /** Nutzervorgabe, 2026-08-27: "Module ... soll mit Button hinzugefügt
   * werden" – ersetzt die frühere Ersetze-alles-PATCH durch einzelne
   * Hinzufügen/Aktivieren-Deaktivieren/Entfernen-Aktionen (siehe
   * `setModuleEnabled`/`removeModule` unten), passend zu einer Liste mit
   * "+ Modul hinzufügen"-Button statt einer vorbefüllten Katalog-Liste
   * mit lauter Schaltern. Neu hinzugefügte Module starten aktiv. */
  async addModule(id: string, moduleKey: string, actingUserId: string) {
    await this.findOne(id);
    if (!isValidModuleKey(moduleKey)) {
      throw new BadRequestException(`Unbekanntes Modul: "${moduleKey}".`);
    }
    await this.prisma.mandantModule.upsert({
      where: { mandantId_moduleKey: { mandantId: id, moduleKey } },
      create: {
        mandantId: id,
        moduleKey,
        bookedById: actingUserId,
        enabledFeatures: getAllFeatureKeys(moduleKey),
      },
      update: {},
    });
    return this.findOne(id);
  }

  /** Datenschutz-als-Modul (Nutzervorgabe, 2026-08-28): "Module ...
   * hinzugefügt, dann aktivierbar und deaktivierbar mit Schieberegler" –
   * pro Unter-Feature (bei Datenschutz: die 7 Reiter), unabhängig vom
   * Aktivsein des ganzen Moduls (siehe `setModuleEnabled` oben). */
  async setModuleFeatureEnabled(
    id: string,
    moduleKey: string,
    featureKey: string,
    enabled: boolean,
  ) {
    if (!isValidFeatureKey(moduleKey, featureKey)) {
      throw new BadRequestException(
        `Unbekanntes Feature "${featureKey}" für Modul "${moduleKey}".`,
      );
    }
    const mandant = await this.findOne(id);
    const booking = mandant.modules.find((m) => m.moduleKey === moduleKey);
    if (!booking) {
      throw new NotFoundException(
        `Modul "${moduleKey}" ist bei diesem Mandanten nicht hinzugefügt.`,
      );
    }
    const nextFeatures = enabled
      ? [...new Set([...booking.enabledFeatures, featureKey])]
      : booking.enabledFeatures.filter((key) => key !== featureKey);
    await this.prisma.mandantModule.update({
      where: { mandantId_moduleKey: { mandantId: id, moduleKey } },
      data: { enabledFeatures: nextFeatures },
    });
    return this.findOne(id);
  }

  /** Nutzervorgabe, 2026-08-27: "wenn dann hinzugefügt wurde, soll
   * aktivierbar und deaktivierbar mit Schieberegler ... laufen" –
   * Hinzufügen und Aktivsein sind getrennte Zustände, siehe Kommentar an
   * `MandantModule.enabled` in schema.prisma. */
  async setModuleEnabled(id: string, moduleKey: string, enabled: boolean) {
    await this.findOne(id);
    await this.prisma.mandantModule
      .update({
        where: { mandantId_moduleKey: { mandantId: id, moduleKey } },
        data: { enabled },
      })
      .catch(() => {
        throw new NotFoundException(
          `Modul "${moduleKey}" ist bei diesem Mandanten nicht hinzugefügt.`,
        );
      });
    return this.findOne(id);
  }

  /** Nutzervorgabe, 2026-08-27: "Module sollen auch entfernt werden
   * können" – löscht die Buchung vollständig (nicht nur deaktivieren). */
  async removeModule(id: string, moduleKey: string) {
    await this.findOne(id);
    await this.prisma.mandantModule
      .delete({
        where: { mandantId_moduleKey: { mandantId: id, moduleKey } },
      })
      .catch(() => {
        throw new NotFoundException(
          `Modul "${moduleKey}" ist bei diesem Mandanten nicht hinzugefügt.`,
        );
      });
    return this.findOne(id);
  }
}
