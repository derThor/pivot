import { CanActivate, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Sperrt die Websites-/Lizenz-Verwaltungsendpunkte einer Installation
 * hart auf API-Ebene, sobald `AppSettings.deploymentMode !== "master"`
 * ist – nicht nur die Sidebar-Sichtbarkeit im Frontend (Nutzervorgabe,
 * 2026-08-24: "stelle sicher, dass ein illegal gesetzter Master nicht
 * Zugriff auf meine Projekte bekommt"). 404 statt 403, damit die
 * Endpunkte auf einer Slave-Installation nach außen so wirken, als
 * existierten sie gar nicht. Bewusst zusätzliche, verteidigungstiefe
 * Maßnahme – die eigentliche Sicherheitsgrenze ist der private
 * Signierschlüssel, der ausschließlich auf dem echten Master liegt (siehe
 * knowledge-base/platform/master-slave-licensing.md,
 * "Sicherheits-Realitätscheck").
 */
@Injectable()
export class MasterOnlyGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(): Promise<boolean> {
    const settings = await this.prisma.appSettings.findUnique({
      where: { id: 1 },
      select: { deploymentMode: true },
    });
    if ((settings?.deploymentMode ?? 'master') !== 'master') {
      throw new NotFoundException();
    }
    return true;
  }
}
