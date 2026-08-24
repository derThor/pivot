import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { verifyLicenseToken } from '../websites/license-token.util';

// Karenzzeit nach Ablauf, bevor eine nicht erreichbare/fehlgeschlagene
// erneute Prüfung tatsächlich zur Sperre führt (siehe
// knowledge-base/platform/master-slave-licensing.md – verhindert, dass
// ein vorübergehend nicht erreichbarer Master je sofort sperrt).
const GRACE_PERIOD_MS = 7 * 24 * 60 * 60 * 1000;

// Toleranz für die Uhrzeit-Manipulationserkennung – kleine, legitime
// Zeitkorrekturen (NTP-Drift) sollen nicht sofort als Rückwärtssprung
// gewertet werden.
const CLOCK_REGRESSION_TOLERANCE_MS = 5 * 60 * 1000;

export type EffectiveLicenseStatus =
  | { mode: 'master' }
  | { mode: 'slave'; status: 'live' | 'development' | 'unchecked' }
  | { mode: 'slave'; status: 'pending'; expiresAt: Date }
  | {
      mode: 'slave';
      status: 'locked';
      maintenanceTitle: string | null;
      maintenanceMessage: string | null;
    };

/**
 * Slave-seitiger Lizenz-Client (siehe
 * knowledge-base/platform/master-slave-licensing.md) – ruft wöchentlich
 * beim Master ab (Pull, nicht Push), verifiziert die Signatur des
 * zurückgegebenen Tokens gegen den lokal hinterlegten öffentlichen
 * Master-Schlüssel, prüft den `seq`-Zähler gegen Replay/Rollback und
 * persistiert den entpackten Zustand in `LicenseState`. Läuft komplett
 * inert (jede Methode früh-returned), solange
 * `AppSettings.deploymentMode !== "slave"` ist.
 */
@Injectable()
export class LicenseClientService implements OnModuleInit {
  private readonly logger = new Logger(LicenseClientService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  private async isSlaveMode(): Promise<boolean> {
    const settings = await this.prisma.appSettings.findUnique({
      where: { id: 1 },
      select: { deploymentMode: true },
    });
    return (settings?.deploymentMode ?? 'master') === 'slave';
  }

  /** Frische Installation: nicht eine volle Woche auf die erste Prüfung
   * warten, sondern gleich beim Start versuchen. */
  async onModuleInit() {
    if (!(await this.isSlaveMode())) return;
    const state = await this.getState();
    if (!state?.lastCheckInAt) {
      await this.performCheck();
    }
  }

  @Cron(CronExpression.EVERY_WEEK)
  async scheduledCheck() {
    if (!(await this.isSlaveMode())) return;
    await this.performCheck();
  }

  private getState() {
    return this.prisma.licenseState.findUnique({ where: { id: 'singleton' } });
  }

  private async recordAttempt(now: Date) {
    // Auch bei Fehlschlag Versuch + beobachtete Zeit aktualisieren (für
    // die Uhrzeit-Manipulationserkennung), aber NICHT den zuletzt
    // erfolgreich abgerufenen Token/Status überschreiben.
    await this.prisma.licenseState.upsert({
      where: { id: 'singleton' },
      create: { id: 'singleton', lastCheckAttemptAt: now, lastObservedAt: now },
      update: { lastCheckAttemptAt: now, lastObservedAt: now },
    });
  }

  async performCheck(): Promise<void> {
    const now = new Date();
    const masterUrl = this.config.get<string>('LICENSE_MASTER_URL');
    const domain = this.config.get<string>('LICENSE_SITE_DOMAIN');
    const apiKey = this.config.get<string>('LICENSE_API_KEY');
    const masterPublicKey = this.config.get<string>(
      'LICENSE_MASTER_PUBLIC_KEY',
    );

    if (!masterUrl || !domain || !apiKey || !masterPublicKey) {
      this.logger.error(
        'Slave-Modus aktiv, aber LICENSE_MASTER_URL/LICENSE_SITE_DOMAIN/' +
          'LICENSE_API_KEY/LICENSE_MASTER_PUBLIC_KEY fehlen – kann keine ' +
          'Lizenzprüfung durchführen.',
      );
      await this.recordAttempt(now);
      return;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);
    try {
      const res = await fetch(`${masterUrl}/license/check`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({ domain }),
        signal: controller.signal,
      });
      if (!res.ok) {
        this.logger.warn(`Lizenzprüfung fehlgeschlagen: HTTP ${res.status}`);
        await this.recordAttempt(now);
        return;
      }
      const data = (await res.json().catch(() => null)) as {
        token?: string;
      } | null;
      if (!data?.token) {
        this.logger.warn('Lizenzprüfung: Antwort ohne Token.');
        await this.recordAttempt(now);
        return;
      }

      const payload = verifyLicenseToken(data.token, masterPublicKey);
      if (!payload) {
        this.logger.error('Lizenz-Token-Signatur ungültig – verworfen.');
        await this.recordAttempt(now);
        return;
      }
      if (payload.domain !== domain) {
        this.logger.error(
          'Lizenz-Token für falsche Domain erhalten – verworfen.',
        );
        await this.recordAttempt(now);
        return;
      }

      const currentState = await this.getState();
      if (currentState && payload.seq <= currentState.seq) {
        this.logger.warn(
          `Lizenz-Token mit seq=${payload.seq} nicht neuer als gespeicherter ` +
            `Stand (${currentState.seq}) – verworfen (Replay-Schutz).`,
        );
        await this.recordAttempt(now);
        return;
      }

      await this.prisma.licenseState.upsert({
        where: { id: 'singleton' },
        create: {
          id: 'singleton',
          token: data.token,
          status: payload.status,
          domain: payload.domain,
          expiresAt: new Date(payload.expiresAt),
          seq: payload.seq,
          lastCheckInAt: now,
          lastCheckAttemptAt: now,
          lastObservedAt: now,
        },
        update: {
          token: data.token,
          status: payload.status,
          domain: payload.domain,
          expiresAt: new Date(payload.expiresAt),
          seq: payload.seq,
          lastCheckInAt: now,
          lastCheckAttemptAt: now,
          lastObservedAt: now,
        },
      });
      this.logger.log(`Lizenzprüfung erfolgreich – Status: ${payload.status}.`);
    } catch (error) {
      this.logger.warn(
        `Lizenzprüfung fehlgeschlagen: ${(error as Error).message}`,
      );
      await this.recordAttempt(now);
    } finally {
      clearTimeout(timeout);
    }
  }

  /** Gesamtstatus für Guard + Frontend (Wartungsseite/Entwicklungsbanner).
   * Berücksichtigt Karenzzeit nach Ablauf und Uhrzeit-Manipulationsschutz
   * (siehe "Sicherheits-Realitätscheck" in der Knowledge-Base). */
  async getEffectiveStatus(): Promise<EffectiveLicenseStatus> {
    if (!(await this.isSlaveMode())) {
      return { mode: 'master' };
    }

    const state = await this.getState();
    const now = new Date();

    if (!state?.status || !state.expiresAt) {
      // Frische Installation, noch nie erfolgreich geprüft – nicht sofort
      // sperren, aber deutlich als ungeprüft kennzeichnen.
      return { mode: 'slave', status: 'unchecked' };
    }

    if (state.status === 'development') {
      return { mode: 'slave', status: 'development' };
    }
    if (state.status === 'locked') {
      return {
        mode: 'slave',
        status: 'locked',
        ...(await this.getMaintenanceContent()),
      };
    }

    // Uhrzeit-Manipulationsschutz: springt die Systemzeit spürbar zurück,
    // darf das nicht automatisch mehr Vertrauen in ein sonst abgelaufenes
    // Token schaffen – wir rechnen dann mit dem höchsten je beobachteten
    // Zeitpunkt statt der (möglicherweise manipulierten) aktuellen Zeit.
    const clockRegressed =
      state.lastObservedAt != null &&
      now.getTime() <
        state.lastObservedAt.getTime() - CLOCK_REGRESSION_TOLERANCE_MS;
    const effectiveNow = clockRegressed ? state.lastObservedAt! : now;

    const isExpired = effectiveNow.getTime() > state.expiresAt.getTime();
    if (!isExpired) {
      return { mode: 'slave', status: 'live' };
    }

    const graceDeadline = state.expiresAt.getTime() + GRACE_PERIOD_MS;
    if (effectiveNow.getTime() <= graceDeadline) {
      return { mode: 'slave', status: 'pending', expiresAt: state.expiresAt };
    }
    return {
      mode: 'slave',
      status: 'locked',
      ...(await this.getMaintenanceContent()),
    };
  }

  /** Nur bei "locked" gebraucht – eigener Query statt in jedem Aufruf von
   * `getEffectiveStatus()` mitzuladen. `GET /license/state` bleibt auch
   * bei Sperre erreichbar (siehe LicenseEnforcementGuard-Allowlist),
   * `GET /settings/public` dagegen nicht mehr – die Wartungsseite muss
   * ihren Inhalt deshalb über diesen Weg bekommen. */
  private async getMaintenanceContent(): Promise<{
    maintenanceTitle: string | null;
    maintenanceMessage: string | null;
  }> {
    const settings = await this.prisma.appSettings.findUnique({
      where: { id: 1 },
      select: { maintenancePageTitle: true, maintenancePageMessage: true },
    });
    return {
      maintenanceTitle: settings?.maintenancePageTitle ?? null,
      maintenanceMessage: settings?.maintenancePageMessage ?? null,
    };
  }
}
