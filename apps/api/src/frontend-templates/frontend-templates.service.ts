import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@pivot/database';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { PrismaService } from '../prisma/prisma.service';
import { SiteCacheService } from '../site-cache/site-cache.service';
import { UPLOAD_DIR } from '../media/media.config';
import { readTemplatePackage } from './template-package';

/** Unterordner im Upload-Verzeichnis. Es wird als Ganzes statisch
 * ausgeliefert (`useStaticAssets(UPLOAD_DIR, { prefix: '/uploads' })` in
 * main.ts), Template-Dateien sind damit ohne eigene Route erreichbar. */
const TEMPLATE_DIR = 'templates';

const templateSelect = {
  id: true,
  key: true,
  name: true,
  version: true,
  manifest: true,
  regions: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} as const;

/**
 * Hochgeladene Frontend-Templates: Paket einlesen, verwahren, umschalten.
 *
 * **Nur das Aussehen.** Ein Paket bringt Manifest, CSS, Bereichs-Vorlagen
 * und Dateien mit – kein ausführbares Programm. Das ist keine
 * Einschränkung dieser Umsetzung, sondern eine Eigenschaft der Sache:
 * React-Komponenten müssten kompiliert werden, CSS und Daten nicht.
 * Deshalb wirkt ein Wechsel sofort, ohne Deploy.
 */
@Injectable()
export class FrontendTemplatesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly siteCache: SiteCacheService,
  ) {}

  findAll() {
    return this.prisma.frontendTemplate.findMany({
      orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
      select: templateSelect,
    });
  }

  /** Das aktive Template mitsamt CSS – für die Website. `null`, solange
   * keines aktiv ist; dann gilt das im Frontend-Projekt eingebaute. */
  findActive() {
    return this.prisma.frontendTemplate.findFirst({
      where: { isActive: true },
      select: { ...templateSelect, css: true },
    });
  }

  /**
   * Nimmt ein hochgeladenes ZIP an.
   *
   * Ein Paket mit bekanntem Schlüssel ERSETZT das vorhandene (gleiche
   * Vorstellung wie bei einem Update): Dateien werden neu geschrieben,
   * der Aktiv-Zustand bleibt, wie er war – wer eine korrigierte Fassung
   * seines laufenden Templates hochlädt, will sie sofort sehen und nicht
   * erst wieder aktivieren müssen.
   */
  async importPackage(buffer: Buffer) {
    // Die Asset-Basis muss vor dem Auspacken feststehen (die Pfade im CSS
    // werden dabei umgeschrieben) – deshalb der Schlüssel als Ordnername
    // und nicht die noch unbekannte Id.
    const probe = readTemplatePackage(buffer, '/uploads/templates/probe');
    const base = `/uploads/${TEMPLATE_DIR}/${probe.key}`;
    const pkg = readTemplatePackage(buffer, base);

    const directory = join(UPLOAD_DIR, TEMPLATE_DIR, pkg.key);
    // Alte Dateien desselben Templates weg, sonst bleiben Reste einer
    // früheren Fassung liegen und werden womöglich noch referenziert.
    await rm(directory, { recursive: true, force: true });
    if (pkg.assets.length > 0) {
      await mkdir(directory, { recursive: true });
      await Promise.all(
        pkg.assets.map((asset) =>
          writeFile(join(directory, asset.name), asset.data),
        ),
      );
    }

    const data = {
      name: pkg.name,
      version: pkg.version ?? null,
      manifest: pkg.manifest as Prisma.InputJsonValue,
      css: pkg.css,
      regions: (pkg.regions ?? Prisma.DbNull) as Prisma.InputJsonValue,
    };
    const saved = await this.prisma.frontendTemplate.upsert({
      where: { key: pkg.key },
      create: { key: pkg.key, ...data },
      update: data,
      select: templateSelect,
    });

    // Nur nötig, wenn gerade dieses Template läuft – dann hat sich das
    // Aussehen der Website eben geändert.
    if (saved.isActive) this.siteCache.invalidate('frontend-template.updated');
    return saved;
  }

  /** Genau eines ist aktiv: erst alle aus, dann dieses an – in EINER
   * Transaktion, damit es keinen Moment mit zwei aktiven gibt. */
  async activate(id: string) {
    const template = await this.prisma.frontendTemplate.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!template) throw new NotFoundException('Template nicht gefunden.');

    const [, activated] = await this.prisma.$transaction([
      this.prisma.frontendTemplate.updateMany({
        where: { isActive: true },
        data: { isActive: false },
      }),
      this.prisma.frontendTemplate.update({
        where: { id },
        data: { isActive: true },
        select: { ...templateSelect, regions: true },
      }),
    ]);
    // Vorlagen des Pakets in LEERE Bereiche übernehmen – gebaute Inhalte
    // bleiben unangetastet (siehe applyRegionPresets).
    const filledRegions = await this.applyRegionPresets(activated.regions);
    this.siteCache.invalidate('frontend-template.activated');
    return { ...activated, filledRegions };
  }

  /**
   * Übernimmt die Bereichs-Vorlagen eines Pakets – **nur in leere
   * Bereiche**.
   *
   * Ein Template-Wechsel darf gebaute Inhalte nicht überschreiben: wer
   * seinen Kopfbereich eingerichtet hat, verliert ihn sonst beim
   * Ausprobieren eines anderen Templates. Leere Bereiche dagegen mit einer
   * sinnvollen Startbelegung zu füllen ist genau der Zweck der Vorlagen.
   *
   * Ergebnis wird gemeldet, damit die Oberfläche sagen kann, was passiert
   * ist ("2 Bereiche vorbelegt") statt es still zu tun.
   */
  private async applyRegionPresets(
    regions: Prisma.JsonValue | null,
  ): Promise<string[]> {
    if (!regions || typeof regions !== 'object' || Array.isArray(regions)) {
      return [];
    }
    const filled: string[] = [];
    for (const [key, preset] of Object.entries(regions)) {
      if (!preset || typeof preset !== 'object' || Array.isArray(preset)) {
        continue;
      }
      const blocks = (preset as { blocks?: unknown }).blocks;
      if (!Array.isArray(blocks) || blocks.length === 0) continue;

      const existing = await this.prisma.templateRegionContent.findUnique({
        where: { key },
        select: { data: true },
      });
      const existingBlocks = (
        existing?.data as { blocks?: unknown[] } | null | undefined
      )?.blocks;
      if (Array.isArray(existingBlocks) && existingBlocks.length > 0) continue;

      await this.prisma.templateRegionContent.upsert({
        where: { key },
        create: { key, data: preset as Prisma.InputJsonValue },
        update: { data: preset as Prisma.InputJsonValue },
      });
      filled.push(key);
    }
    return filled;
  }

  /** Zurück auf das im Frontend-Projekt eingebaute Template. */
  async deactivateAll() {
    await this.prisma.frontendTemplate.updateMany({
      where: { isActive: true },
      data: { isActive: false },
    });
    this.siteCache.invalidate('frontend-template.deactivated');
    return { active: null };
  }

  /** Manifest (und Name) nachbearbeiten, ohne das Paket neu zu bauen –
   * genau dafür ist das Manifest Daten und kein Code. */
  async update(
    id: string,
    dto: { name?: string; manifest?: Record<string, unknown> },
  ) {
    const updated = await this.prisma.frontendTemplate.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.manifest !== undefined && {
          manifest: dto.manifest as Prisma.InputJsonValue,
        }),
      },
      select: templateSelect,
    });
    if (updated.isActive)
      this.siteCache.invalidate('frontend-template.updated');
    return updated;
  }

  /** Löschen samt Dateien. Das aktive Template lässt sich nicht löschen –
   * sonst stünde die Website ohne Gestaltung da, ohne dass jemand das
   * beabsichtigt hätte. Erst umschalten, dann löschen. */
  async remove(id: string) {
    const template = await this.prisma.frontendTemplate.findUnique({
      where: { id },
      select: { id: true, key: true, isActive: true },
    });
    if (!template) throw new NotFoundException('Template nicht gefunden.');
    if (template.isActive) {
      throw new BadRequestException(
        'Das aktive Template lässt sich nicht löschen. Erst ein anderes aktivieren oder auf das eingebaute zurückschalten.',
      );
    }
    await this.prisma.frontendTemplate.delete({ where: { id } });
    await rm(join(UPLOAD_DIR, TEMPLATE_DIR, template.key), {
      recursive: true,
      force: true,
    });
    return { id };
  }
}
