import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';

const CHECK_TIMEOUT_MS = 10_000;

// `JobRun.jobId` für diesen Job (siehe checkLockedWebsites()) – taucht in
// der "Letzte Läufe"-Karte unter Einstellungen → Jobs auf, aber bewusst
// NICHT in `JobsService.definitions` (siehe dortiger Kommentar) – rein
// lesbare Historie, kein Pausier-/Umplanungs-Hebel für diese
// sicherheitsrelevante Überwachung.
export const WEBSITE_MONITOR_JOB_ID = 'website-monitor';

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

  /** Master-Only, aber anders als die Controller-Routen NICHT über
   * `MasterOnlyGuard` – ein Cron durchläuft keine Guards. Ohne diese
   * Prüfung lief der Job auch auf jeder Client-Installation und schrieb
   * dort "Letzte Läufe"-Einträge eines Master-Jobs, der dort nie etwas zu
   * tun haben kann (Nutzer-Bugreport, 2026-09-02: "das bekomme ich auf dem
   * client"). Bewusst VOR dem `scheduledJob.upsert()` – sonst bliebe die
   * Job-Zeile auf dem Client stehen. */
  private async isMaster(): Promise<boolean> {
    const settings = await this.prisma.appSettings.findUnique({
      where: { id: 1 },
      select: { deploymentMode: true },
    });
    return (settings?.deploymentMode ?? 'master') === 'master';
  }

  @Cron(CronExpression.EVERY_30_MINUTES)
  async checkLockedWebsites() {
    if (!(await this.isMaster())) return;
    const startedAt = new Date();
    const lockedSites = await this.prisma.website.findMany({
      where: { status: 'locked' },
      select: { id: true, domain: true, testUrl: true },
    });
    const anomalies = await Promise.all(
      lockedSites.map((site) => this.checkSite(site)),
    );
    const anomalyCount = anomalies.filter(Boolean).length;
    // `JobRun.jobId` ist per Fremdschlüssel an `ScheduledJob` gebunden,
    // daher zuerst eine (idempotente) Zeile dort anlegen – bewusst NICHT in
    // `JobsService.definitions` registriert, siehe Kommentar am
    // `WEBSITE_MONITOR_JOB_ID`-Export oben.
    await this.prisma.scheduledJob.upsert({
      where: { id: WEBSITE_MONITOR_JOB_ID },
      create: {
        id: WEBSITE_MONITOR_JOB_ID,
        cronExpression: '*/30 * * * *',
        isCritical: true,
      },
      update: {},
    });
    await this.prisma.jobRun.create({
      data: {
        jobId: WEBSITE_MONITOR_JOB_ID,
        startedAt,
        durationMs: Date.now() - startedAt.getTime(),
        status: 'success',
        message:
          lockedSites.length === 0
            ? 'Aktuell ist keine Webseite gesperrt.'
            : `${lockedSites.length} gesperrte Webseite(s) geprüft — ${
                anomalyCount === 0
                  ? 'keine Auffälligkeit'
                  : `${anomalyCount} trotz Sperre erreichbar`
              }.`,
      },
    });
  }

  private async checkSite(site: {
    id: string;
    domain: string;
    testUrl: string | null;
  }): Promise<boolean> {
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
    return anomaly;
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
