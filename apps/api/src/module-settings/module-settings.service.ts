import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  MODULE_CATALOG,
  getAllFeatureKeys,
  isValidModuleKey,
  isValidFeatureKey,
} from '../websites/module-catalog';
import { UpdateModuleSettingsDto } from './dto/update-module-settings.dto';

/**
 * Datenschutz-als-Modul (Nutzervorgabe, 2026-08-28): Masters EIGENE
 * Modul-/Feature-Freischaltung ("Master wird nicht über Mandanten
 * geregelt") – editierbar unter Einstellungen → Module, nur auf einer
 * Master-Installation sichtbar/erreichbar. Fehlt für einen Katalog-
 * Eintrag noch eine `ModuleSettings`-Zeile, gilt der Schema-Default
 * (aktiv, alle Feature-Keys an) – siehe auch
 * `LicenseClientService.getMasterModuleEntitlements()`, die denselben
 * Default anwendet.
 */
@Injectable()
export class ModuleSettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    const rows = await this.prisma.moduleSettings.findMany();
    const rowByKey = new Map(rows.map((r) => [r.moduleKey, r]));
    return MODULE_CATALOG.map((entry) => {
      const row = rowByKey.get(entry.key);
      return {
        moduleKey: entry.key,
        label: entry.label,
        category: entry.category,
        usedByMasterItself: entry.usedByMasterItself,
        features: entry.features ?? [],
        enabled: row?.enabled ?? true,
        enabledFeatures: row
          ? row.enabledFeatures
          : getAllFeatureKeys(entry.key),
        autoInstallForNewMandants: row?.autoInstallForNewMandants ?? false,
      };
    });
  }

  async findOne(moduleKey: string) {
    const all = await this.findAll();
    const entry = all.find((e) => e.moduleKey === moduleKey);
    if (!entry) {
      throw new BadRequestException(`Unbekanntes Modul: "${moduleKey}".`);
    }
    return entry;
  }

  private async ensureRow(moduleKey: string) {
    if (!isValidModuleKey(moduleKey)) {
      throw new BadRequestException(`Unbekanntes Modul: "${moduleKey}".`);
    }
    return this.prisma.moduleSettings.upsert({
      where: { moduleKey },
      create: { moduleKey, enabledFeatures: getAllFeatureKeys(moduleKey) },
      update: {},
    });
  }

  async update(moduleKey: string, dto: UpdateModuleSettingsDto) {
    await this.ensureRow(moduleKey);
    await this.prisma.moduleSettings.update({
      where: { moduleKey },
      data: dto,
    });
    // Nutzervorgabe, 2026-08-29: der Schalter in den Modul-Kacheln ist ein
    // Kill-Switch für ALLE Mandanten, kein rein lokaler Master-Schalter
    // mehr. Deaktivieren setzt jede bestehende `MandantModule`-Buchung
    // dieses Moduls auf `enabled: false` ("überall auf inaktiv"). Beim
    // Reaktivieren werden NUR bestehende Buchungen wieder auf `true`
    // gesetzt ("nur die, die das Modul schon hatten") – Mandanten ohne
    // eigene Buchung sind von `updateMany` gar nicht betroffen und
    // bekommen das Modul dadurch nicht automatisch zugewiesen.
    if (dto.enabled !== undefined) {
      await this.prisma.mandantModule.updateMany({
        where: { moduleKey },
        data: { enabled: dto.enabled },
      });
    }
    return this.findOne(moduleKey);
  }

  async setFeatureEnabled(
    moduleKey: string,
    featureKey: string,
    enabled: boolean,
  ) {
    if (!isValidFeatureKey(moduleKey, featureKey)) {
      throw new BadRequestException(
        `Unbekanntes Feature "${featureKey}" für Modul "${moduleKey}".`,
      );
    }
    const row = await this.ensureRow(moduleKey);
    const nextFeatures = enabled
      ? [...new Set([...row.enabledFeatures, featureKey])]
      : row.enabledFeatures.filter((key) => key !== featureKey);
    await this.prisma.moduleSettings.update({
      where: { moduleKey },
      data: { enabledFeatures: nextFeatures },
    });
    return this.findOne(moduleKey);
  }
}
