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

// `JobRun.jobId` für die Lizenzprüfung (siehe recordJobRun()) – taucht in
// der "Letzte Läufe"-Karte unter Einstellungen → Jobs auf, aber bewusst
// NICHT in `JobsService.definitions`, siehe dortiger Kommentar.
export const LICENSE_CHECK_JOB_ID = 'license-check';

interface JobOutcome {
  status: 'success' | 'error';
  message: string;
}

export interface LockedPageBranding {
  maintenanceTitle: string | null;
  maintenanceMessage: string | null;
  companyName: string | null;
  companyLogoUrl: string | null;
  companyEmail: string | null;
  companyPhone: string | null;
  companyCity: string | null;
  accentColor: string | null;
}

export type EffectiveLicenseStatus =
  | { mode: 'master' }
  | { mode: 'slave'; status: 'live' | 'development' | 'unchecked' }
  | { mode: 'slave'; status: 'pending'; expiresAt: Date }
  | ({ mode: 'slave'; status: 'locked' } & LockedPageBranding);

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

  // Abklingzeit für `/license/wakeup` (Nutzerfrage, 2026-08-24: "kann man
  // die Seite lahmlegen durch Aufruf der Wecken-Funktion?") – rein
  // defensiv: der Aufruf war schon vorher durch den gleichen Schlüssel wie
  // `/license/check` UND den globalen `ThrottlerGuard` (100/Minute pro IP)
  // abgesichert, ein Angreifer mit dem Key könnte ohnehin nichts erreichen,
  // was er nicht schon über `/license/check` direkt könnte. Diese
  // In-Memory-Sperre schützt zusätzlich davor, dass derselbe gültige Key
  // über mehrere IPs verteilt den IP-basierten Rate-Limit umgeht und so
  // wiederholt echte Master-Anfragen samt DB-Schreibzugriffen auslöst.
  private lastWakeupTriggeredAt = 0;
  private readonly WAKEUP_COOLDOWN_MS = 60_000;

  async requestWakeup(): Promise<void> {
    const now = Date.now();
    if (now - this.lastWakeupTriggeredAt < this.WAKEUP_COOLDOWN_MS) return;
    this.lastWakeupTriggeredAt = now;
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

  /** Nutzervorgabe, 2026-08-24: "Job soll unter Einstellungen → Jobs
   * auftauchen" – schreibt bei jedem Lauf einen `JobRun` mit `jobId:
   * "license-check"`, damit die bestehende "Letzte Läufe"-Karte die
   * Historie automatisch mit anzeigt. `JobRun.jobId` ist per Fremdschlüssel
   * an `ScheduledJob` gebunden, daher zuerst eine (idempotente) Zeile dort
   * anlegen – aber bewusst NICHT in `JobsService.definitions` registrieren:
   * dort ließe sich der Job pausieren/umplanen, was genau die Durchsetzung
   * unterläuft, die er eigentlich sicherstellen soll. Ohne Eintrag in
   * `definitions` findet `JobsService.update()`/`runNow()` diese Zeile nie
   * (siehe `getDefinition()` dort) – rein lesbare Historie, keine neue
   * Bearbeitungsfläche. */
  private async recordJobRun(startedAt: Date, outcome: JobOutcome) {
    await this.prisma.scheduledJob.upsert({
      where: { id: LICENSE_CHECK_JOB_ID },
      create: {
        id: LICENSE_CHECK_JOB_ID,
        cronExpression: '0 0 * * 1',
        isCritical: true,
      },
      update: {},
    });
    await this.prisma.jobRun.create({
      data: {
        jobId: LICENSE_CHECK_JOB_ID,
        startedAt,
        durationMs: Date.now() - startedAt.getTime(),
        status: outcome.status,
        message: outcome.message,
      },
    });
  }

  async performCheck(): Promise<void> {
    const startedAt = new Date();
    const outcome = await this.runCheck(startedAt);
    await this.recordJobRun(startedAt, outcome);
  }

  private async runCheck(now: Date): Promise<JobOutcome> {
    const masterUrl = this.config.get<string>('LICENSE_MASTER_URL');
    const domain = this.config.get<string>('LICENSE_SITE_DOMAIN');
    const apiKey = this.config.get<string>('LICENSE_API_KEY');
    const masterPublicKey = this.config.get<string>(
      'LICENSE_MASTER_PUBLIC_KEY',
    );

    if (!masterUrl || !domain || !apiKey || !masterPublicKey) {
      const message =
        'Slave-Modus aktiv, aber LICENSE_MASTER_URL/LICENSE_SITE_DOMAIN/' +
        'LICENSE_API_KEY/LICENSE_MASTER_PUBLIC_KEY fehlen – kann keine ' +
        'Lizenzprüfung durchführen.';
      this.logger.error(message);
      await this.recordAttempt(now);
      return { status: 'error', message };
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
        const message = `Lizenzprüfung fehlgeschlagen: HTTP ${res.status}`;
        this.logger.warn(message);
        await this.recordAttempt(now);
        return { status: 'error', message };
      }
      const data = (await res.json().catch(() => null)) as {
        token?: string;
      } | null;
      if (!data?.token) {
        const message = 'Lizenzprüfung: Antwort ohne Token.';
        this.logger.warn(message);
        await this.recordAttempt(now);
        return { status: 'error', message };
      }

      const payload = verifyLicenseToken(data.token, masterPublicKey);
      if (!payload) {
        const message = 'Lizenz-Token-Signatur ungültig – verworfen.';
        this.logger.error(message);
        await this.recordAttempt(now);
        return { status: 'error', message };
      }
      if (payload.domain !== domain) {
        const message = 'Lizenz-Token für falsche Domain erhalten – verworfen.';
        this.logger.error(message);
        await this.recordAttempt(now);
        return { status: 'error', message };
      }

      const currentState = await this.getState();
      if (currentState && payload.seq <= currentState.seq) {
        const message =
          `Lizenz-Token mit seq=${payload.seq} nicht neuer als gespeicherter ` +
          `Stand (${currentState.seq}) – verworfen (Replay-Schutz).`;
        this.logger.warn(message);
        await this.recordAttempt(now);
        return { status: 'error', message };
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
      const message = `Status: ${payload.status}.`;
      this.logger.log(`Lizenzprüfung erfolgreich – ${message}`);
      return { status: 'success', message };
    } catch (error) {
      const message = `Lizenzprüfung fehlgeschlagen: ${(error as Error).message}`;
      this.logger.warn(message);
      await this.recordAttempt(now);
      return { status: 'error', message };
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
   * `GET /settings/public` dagegen nicht mehr – die Wartungsseite
   * (`apps/web/src/app/locked/page.tsx`) muss ihren KOMPLETTEN Inhalt
   * (Titel/Text UND Marke: Firmenname/Logo/Kontakt/Akzentfarbe) deshalb
   * über diesen Weg bekommen, nicht über `getPublicSettings()`. */
  private async getMaintenanceContent(): Promise<LockedPageBranding> {
    const settings = await this.prisma.appSettings.findUnique({
      where: { id: 1 },
      select: {
        maintenancePageTitle: true,
        maintenancePageMessage: true,
        companyName: true,
        companyLogoUrl: true,
        companyEmail: true,
        companyPhone: true,
        companyCity: true,
        accentColor: true,
      },
    });
    return {
      maintenanceTitle: settings?.maintenancePageTitle ?? null,
      maintenanceMessage: settings?.maintenancePageMessage ?? null,
      companyName: settings?.companyName ?? null,
      companyLogoUrl: settings?.companyLogoUrl ?? null,
      companyEmail: settings?.companyEmail ?? null,
      companyPhone: settings?.companyPhone ?? null,
      companyCity: settings?.companyCity ?? null,
      accentColor: settings?.accentColor ?? null,
    };
  }
}
