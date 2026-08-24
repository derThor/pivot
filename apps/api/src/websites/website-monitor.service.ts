import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';

const CHECK_TIMEOUT_MS = 10_000;

/**
 * Master-seitige Live-Überwachung gesperrter Websites (Nutzervorgabe,
 * 2026-08-24: "baue einen Test ein, der regelmäßig testet, ob eine Seite
 * live ist. wenn gesperrt, dennoch live, dass ich in Master gewarnt
 * werde"). Bewusst ein ganz normaler, öffentlicher HTTP-Aufruf gegen die
 * Website selbst – kein verdecktes Signal von der Slave-Installation
 * (siehe abgelehnter Vorschlag in knowledge-base/platform/
 * master-slave-licensing.md), sondern dieselbe Art Anfrage, die auch ein
 * gewöhnlicher Besucher machen würde.
 *
 * Das Ergebnis (`lastLiveCheckAnomaly`) wird nur persistiert, die
 * eigentliche Benachrichtigung entsteht über den bestehenden
 * NotificationsService.buildCandidates()-Mechanismus (gleiches Muster wie
 * "Webhook schlägt fehl").
 */
@Injectable()
export class WebsiteMonitorService {
  private readonly logger = new Logger(WebsiteMonitorService.name);

  constructor(private readonly prisma: PrismaService) {}

  @Cron(CronExpression.EVERY_30_MINUTES)
  async checkLockedWebsites() {
    const lockedSites = await this.prisma.website.findMany({
      where: { status: 'locked' },
      select: { id: true, domain: true, testUrl: true },
    });
    await Promise.all(lockedSites.map((site) => this.checkSite(site)));
  }

  private async checkSite(site: {
    id: string;
    domain: string;
    testUrl: string | null;
  }) {
    const anomaly = await this.isSiteUnexpectedlyLive(
      site.testUrl ?? `https://${site.domain}/`,
    );
    try {
      await this.prisma.website.update({
        where: { id: site.id },
        data: { lastLiveCheckAt: new Date(), lastLiveCheckAnomaly: anomaly },
      });
    } catch (error) {
      this.logger.warn(
        `Live-Check-Ergebnis für ${site.domain} konnte nicht gespeichert werden: ${(error as Error).message}`,
      );
    }
  }

  /** `true`, wenn die Seite trotz Sperre normal antwortet (Anomalie). Ein
   * fehlgeschlagener/nicht erreichbarer Aufruf ist hingegen unauffällig –
   * genau das erwarten wir von einer korrekt durchgesetzten Sperre.
   * `url` ist entweder `https://{domain}/` oder – bei lokalen Test-
   * Installationen – die hinterlegte `testUrl` (siehe `Website.testUrl`). */
  private async isSiteUnexpectedlyLive(url: string): Promise<boolean> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), CHECK_TIMEOUT_MS);
    try {
      const res = await fetch(url, {
        signal: controller.signal,
        redirect: 'follow',
      });
      if (!res.ok) return false;
      const body = await res.text();
      // Siehe MAINTENANCE_PAGE_MARKER in apps/web – die Wartungsseite
      // trägt dieses Meta-Tag, eine normale Seite nicht.
      return !body.includes('name="pivot-maintenance"');
    } catch {
      return false;
    } finally {
      clearTimeout(timeout);
    }
  }
}
