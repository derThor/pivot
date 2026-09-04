import { Injectable } from '@nestjs/common';
import { Prisma } from '@pivot/database';
import { PrismaService } from '../prisma/prisma.service';
import { SiteCacheService } from '../site-cache/site-cache.service';

/**
 * Die Inhalte der Bereiche, die das Frontend-Template deklariert hat
 * (Kopfbereich, Fußbereich, … – siehe `regions` in seinem Manifest).
 * Stufe 2 der Template-Mechanik, siehe
 * knowledge-base/frontend/template-manifest.md.
 *
 * **Was diese Schicht bewusst NICHT tut: prüfen, ob ein Schlüssel im
 * Manifest steht.** Das Manifest lebt im Frontend-Projekt; die API kennt
 * es nicht und soll es nicht kennen – sonst gäbe es zwei Wahrheiten. Sie
 * verwahrt Bausteine unter einem Schlüssel, mehr nicht. Welche Schlüssel
 * es gibt, entscheidet die Oberfläche anhand des Manifests, und was
 * gerendert wird, entscheidet das Template.
 *
 * Folge: ein Bereich, den das Manifest nicht (mehr) kennt, bleibt hier
 * unangetastet liegen statt gelöscht zu werden – dasselbe Prinzip wie bei
 * den Template-Einstellungen.
 */
@Injectable()
export class TemplateRegionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly siteCache: SiteCacheService,
  ) {}

  findAll() {
    return this.prisma.templateRegionContent.findMany({
      orderBy: { key: 'asc' },
      select: { key: true, data: true, updatedAt: true },
    });
  }

  async findOne(key: string) {
    const region = await this.prisma.templateRegionContent.findUnique({
      where: { key },
      select: { key: true, data: true, updatedAt: true },
    });
    // Kein Datensatz ist der Normalfall (Bereich noch nie bearbeitet) und
    // deshalb kein 404: die Oberfläche soll einen leeren Designer öffnen,
    // nicht einen Fehler zeigen.
    return region ?? { key, data: { blocks: [] }, updatedAt: null };
  }

  /** Legt an oder überschreibt – ein Bereich ist pro Installation
   * einmalig, ein "zweiter Kopfbereich" ergäbe keinen Sinn. */
  async save(key: string, data: Prisma.InputJsonValue) {
    const saved = await this.prisma.templateRegionContent.upsert({
      where: { key },
      create: { key, data },
      update: { data },
      select: { key: true, data: true, updatedAt: true },
    });
    // Bereiche stehen auf JEDER Seite – ohne dieses Verwerfen bliebe eine
    // Änderung bis zum Ablauf der Zwischenspeicher-Dauer unsichtbar.
    this.siteCache.invalidate('template-region.changed');
    return saved;
  }
}
