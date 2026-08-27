import {
  BadRequestException,
  Injectable,
  Logger,
  OnModuleInit,
  UnauthorizedException,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { PrismaService } from '../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';
import { verifyLicenseToken } from '../websites/license-token.util';
import { decryptSecret } from '../common/utils/secret-encryption';
import { DEVELOPMENT_MODE_MAX_DAYS } from '../websites/websites.service';

// Zweckgebundenes Kurzzeit-Token zwischen den beiden Schritten des
// Wiederherstellungs-Popups auf der Wartungsseite (siehe
// verifyRecoveryCredentials()/applyRecoveryKey() unten) – bewusst KEIN
// echter Login-Token (kein Zugriff auf irgendeine andere Route), daher
// eigener `purpose`-Diskriminator statt Wiederverwendung der normalen
// Access-Token-Struktur.
interface LicenseRecoveryPayload {
  sub: string;
  purpose: 'license-recovery';
}

// Kurz genug, dass ein abgefangenes Token kaum Schaden anrichten kann, lang
// genug für die zwei Formular-Schritte im Popup.
const LICENSE_RECOVERY_TOKEN_TTL_MS = 5 * 60 * 1000;

// Sicherheits-Review, 2026-08-27: fester Dummy-Hash für
// `verifyRecoveryCredentials()` – ohne ihn lief `argon2.verify()` nur,
// wenn ein Nutzer mit dieser E-Mail existiert UND `settings:update` hat
// (Kurzschlussauswertung), wodurch die Antwortzeit verriet, ob eine
// E-Mail überhaupt existiert bzw. zu einem berechtigten Konto gehört.
// Inhalt/Passwort dahinter sind irrelevant, nur das Format muss gültig
// sein.
const DUMMY_PASSWORD_HASH =
  '$argon2id$v=19$m=65536,t=3,p=4$OLj+xHKa3w2ZW39BsDDAeQ$1UZP+LwHy7i6hPk0a4Ff77jxXDTFzJhnAPZjzR13cCI';

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

export interface JobOutcome {
  status: 'success' | 'error';
  message: string;
  // Nur bei erfolgreicher Prüfung gesetzt (Nutzervorgabe, 2026-08-25:
  // "hier die entsprechenden Badges nehmen" – der Master soll den echten
  // Lizenzstatus als Badge zeigen können, statt ihn aus dem Freitext der
  // `message` herauszulesen).
  licenseStatus?: 'live' | 'development' | 'locked';
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
  | { mode: 'slave'; status: 'unchecked' }
  // Mandantenfähigkeit, 2026-08-27: `modules` sind die zuletzt vom Master
  // signiert bestätigten, gebuchten Modul-Keys dieser Installation (siehe
  // LicenseState.modules) – einzige Stelle, an der eine Installation ihre
  // eigenen Entitlements erfährt.
  | { mode: 'slave'; status: 'live'; modules: string[] }
  | {
      mode: 'slave';
      status: 'development';
      // Nutzervorgabe, 2026-08-25: "Entwicklermodus wird nach spätestens 3
      // Tagen automatisch gesperrt" – für die "wird gesperrt am ..."-
      // Anzeige im Toast. `null` bei einer sehr frischen Installation, die
      // noch keinen Check mit diesem Feld hinter sich hat.
      developmentModeSince: Date | null;
      autoLockAt: Date | null;
      modules: string[];
    }
  | { mode: 'slave'; status: 'pending'; expiresAt: Date; modules: string[] }
  | ({
      mode: 'slave';
      status: 'locked';
      // Nutzervorgabe, 2026-08-26: "Login mit Lizenzeingabe darf nur
      // kommen, wenn der Schlüssel ungültig ist" – unterscheidet, WARUM
      // gesperrt wurde: `false` = der Master hat beim letzten erfolgreichen
      // Abgleich selbst "locked" signiert (z.B. Kunde zahlt nicht) – der
      // Key ist dabei nachweislich noch korrekt, ein neuer Key würde nichts
      // ändern. `true` = die letzte bekannte, erfolgreich verifizierte
      // Vorgabe war NICHT "locked", die Installation ist erst durch
      // wiederholt fehlgeschlagene Abgleiche über die Karenzzeit gerutscht
      // (typischste Ursache: ein nicht mehr passender Key) – hier macht das
      // Wiederherstellungs-Popup tatsächlich Sinn.
      keySuspect: boolean;
    } & LockedPageBranding);

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
    private readonly jwt: JwtService,
    private readonly settingsService: SettingsService,
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

  // Update 2026-08-24: Abklingzeit wieder entfernt – sie schluckte einen
  // legitimen Wecken-Aufruf stillschweigend (meldete trotzdem "erfolgreich"),
  // sobald kurz zuvor aus irgendeinem Grund schon eine Prüfung lief (eigener
  // vorheriger Klick, Cron, o.ä.) – genau der normale Ablauf "sperren, dann
  // sofort wecken" lief dadurch ins Leere. War ohnehin nur rein defensiv
  // gedacht (der Aufruf ist schon durch denselben Key wie `/license/check`
  // UND den globalen `ThrottlerGuard` abgesichert, kein akutes Loch ohne
  // sie) – der Schaden an der eigentlichen Funktion wiegt schwerer als der
  // marginale zusätzliche Schutz.
  async requestWakeup(): Promise<JobOutcome> {
    return this.performCheck();
  }

  /** Nutzer-Bugreport, 2026-08-26: ein Weck-Aufruf mit falschem Bearer
   * scheitert schon an `LicenseStateController.wakeup()`s eigenem
   * Schlüsselvergleich, BEVOR `requestWakeup()`/`runCheck()` je aufgerufen
   * wird – `LicenseState.lastCheckAttemptAt` blieb dadurch unverändert und
   * `keySuspect` (siehe `getEffectiveStatus()`) wurde nie `true`, egal wie
   * oft der Master erfolglos weckte. Der Vergleich dort nutzt exakt
   * denselben `getApiKey()`-Wert wie `runCheck()` für den eigenen
   * ausgehenden Abgleich – ein falscher Bearer ist also genauso aussage-
   * kräftig wie ein fehlgeschlagener eigener Versuch. */
  async recordFailedWakeupAttempt() {
    await this.recordAttempt(new Date());
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

  /** Gibt das tatsächliche Ergebnis zurück (Nutzer-Bugreport, 2026-08-24:
   * "ich habe den Key erneuert, dann bei strasev ohne was anzupassen
   * geprüft, und alles in Ordnung?????") – vorher gaben `recheck()`/
   * `requestWakeup()` bei einem fehlgeschlagenen Versuch trotzdem den
   * (veralteten, aus `LicenseState` zwischengespeicherten) Gesamtstatus
   * zurück, ohne dass die eigentliche Prüfung gerade fehlgeschlagen war
   * jemals sichtbar wurde. */
  async performCheck(): Promise<JobOutcome> {
    const startedAt = new Date();
    const outcome = await this.runCheck(startedAt);
    await this.recordJobRun(startedAt, outcome);
    return outcome;
  }

  /** Bevorzugt den über Einstellungen → Master-Client gesetzten Key
   * (Nutzervorgabe, 2026-08-24: "eine Eingabe, wo man den Schlüssel ändern
   * kann") – fällt auf die `LICENSE_API_KEY`-Umgebungsvariable zurück,
   * solange noch nie über die UI ein Key gesetzt wurde (Erstinbetriebnahme
   * per `.env`, wie bisher). Gleicher Verschlüsselungs-Helfer wie das
   * SMTP-Passwort. */
  async getApiKey(): Promise<string | undefined> {
    const settings = await this.prisma.appSettings.findUnique({
      where: { id: 1 },
      select: { licenseApiKeyEncrypted: true },
    });
    if (settings?.licenseApiKeyEncrypted) {
      return decryptSecret(
        settings.licenseApiKeyEncrypted,
        this.config.getOrThrow<string>('TOTP_ENCRYPTION_KEY'),
      );
    }
    return this.config.get<string>('LICENSE_API_KEY');
  }

  private async runCheck(now: Date): Promise<JobOutcome> {
    const masterUrl = this.config.get<string>('LICENSE_MASTER_URL');
    const domain = this.config.get<string>('LICENSE_SITE_DOMAIN');
    const apiKey = await this.getApiKey();
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

      const developmentModeSince = payload.developmentModeSince
        ? new Date(payload.developmentModeSince)
        : null;
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
          developmentModeSince,
          // Mandantenfähigkeit, 2026-08-27 – Fallback für Tokens, die ein
          // Master vor diesem Feature ausgestellt hat (ohne `modules`-Feld).
          modules: payload.modules ?? [],
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
          developmentModeSince,
          modules: payload.modules ?? [],
        },
      });
      const message = `Status: ${payload.status}.`;
      this.logger.log(`Lizenzprüfung erfolgreich – ${message}`);
      return { status: 'success', message, licenseStatus: payload.status };
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

    // Nutzervorgabe, 2026-08-26: "Login mit Lizenzeingabe darf nur kommen,
    // wenn der Schlüssel ungültig ist" – ob der KEY das Problem ist, hängt
    // nicht daran, WARUM `state.status` gerade "locked" ist (das könnte ein
    // längst vergangener, damals noch mit korrektem Key erhaltener Stand
    // sein), sondern ausschließlich daran, ob der ZULETZT tatsächlich
    // unternommene Versuch erfolgreich war: `recordAttempt()` schreibt bei
    // jedem Versuch `lastCheckAttemptAt`, aber nur ein Erfolg aktualisiert
    // zusätzlich `lastCheckInAt` auf denselben Zeitpunkt – liegt
    // `lastCheckAttemptAt` danach spürbar VOR dem nächsten Versuch, ohne
    // dass `lastCheckInAt` mitgezogen wurde, ist genau das der Fall (z.B.
    // nachträglich falsch eingetragener Key, der Status war vorher schon
    // "locked"). Alte, inzwischen durch neuere Versuche überholte
    // Erfolge zählen nicht mehr mit.
    const keySuspect = !!(
      state.lastCheckAttemptAt &&
      (!state.lastCheckInAt ||
        state.lastCheckAttemptAt.getTime() > state.lastCheckInAt.getTime())
    );

    if (state.status === 'development') {
      const autoLockAt = state.developmentModeSince
        ? new Date(
            state.developmentModeSince.getTime() +
              DEVELOPMENT_MODE_MAX_DAYS * 24 * 60 * 60 * 1000,
          )
        : null;
      return {
        mode: 'slave',
        status: 'development',
        developmentModeSince: state.developmentModeSince,
        autoLockAt,
        modules: state.modules,
      };
    }
    if (state.status === 'locked') {
      return {
        mode: 'slave',
        status: 'locked',
        keySuspect,
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
      return { mode: 'slave', status: 'live', modules: state.modules };
    }

    const graceDeadline = state.expiresAt.getTime() + GRACE_PERIOD_MS;
    if (effectiveNow.getTime() <= graceDeadline) {
      return {
        mode: 'slave',
        status: 'pending',
        expiresAt: state.expiresAt,
        modules: state.modules,
      };
    }
    return {
      mode: 'slave',
      status: 'locked',
      keySuspect,
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

  /** Schritt 1 des Wiederherstellungs-Popups auf der Wartungsseite
   * (Nutzervorgabe, 2026-08-26): eine gesperrte Installation blockt über
   * `LicenseEnforcementGuard` fast jede Route inkl. Login – ohne diesen Weg
   * gäbe es keine Möglichkeit mehr, einen versehentlich falsch eingetragenen
   * Lizenz-Key selbst zu korrigieren, sobald die Installation einmal
   * gesperrt ist. Bewusst KEIN echter Login (kein Access-/Refresh-Token,
   * keine Dashboard-Session) – nur ein kurzlebiges, eng zweckgebundenes
   * Token für Schritt 2 (Key eintragen). Prüft Passwort UND
   * `settings:update`-Recht (nur wer den Key im normalen Betrieb ändern
   * dürfte, darf es auch hier tun) – generische Fehlermeldung wie beim
   * normalen Login, keine Auskunft, welcher Teil falsch war.
   *
   * Sicherheits-Review, 2026-08-27: `argon2.verify()` läuft jetzt IMMER
   * (gegen `DUMMY_PASSWORD_HASH`, falls kein Nutzer existiert), statt nur
   * bei existierendem + berechtigtem Konto – sonst verrät allein die
   * Antwortzeit, ob eine E-Mail existiert bzw. zu einem `settings:update`-
   * Konto gehört. Ein falsches Passwort zählt außerdem auf dieselbe
   * Fehlversuchssperre wie der normale Login (`AuthService.login()`),
   * sonst wäre dieser Endpunkt ein zweiter, unlimitierter Rateweg fürs
   * Erraten von Admin-Passwörtern, der die bestehende Kontosperre
   * umgeht. */
  async verifyRecoveryCredentials(
    email: string,
    password: string,
  ): Promise<string> {
    if (!(await this.isSlaveMode())) {
      throw new BadRequestException(
        'Nur auf einer Client-Installation verfügbar.',
      );
    }
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: {
        userRoles: {
          include: {
            role: {
              include: { permissions: { include: { permission: true } } },
            },
          },
        },
      },
    });
    const passwordOk = await argon2.verify(
      user?.passwordHash ?? DUMMY_PASSWORD_HASH,
      password,
    );

    if (user && !passwordOk) {
      const settings = await this.settingsService.get();
      const failedLoginAttempts = user.failedLoginAttempts + 1;
      const shouldLock =
        settings.failedLoginLockoutThreshold != null &&
        failedLoginAttempts >= settings.failedLoginLockoutThreshold;
      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          failedLoginAttempts,
          ...(shouldLock && { isActive: false }),
        },
      });
    }

    const permissions = user
      ? [
          ...new Set(
            user.userRoles.flatMap((userRole) =>
              userRole.role.permissions.map(
                (rolePermission) =>
                  `${rolePermission.permission.resource}:${rolePermission.permission.action}`,
              ),
            ),
          ),
        ]
      : [];
    const isValid =
      !!user &&
      user.isActive &&
      passwordOk &&
      permissions.includes('settings:update');
    if (!isValid) {
      throw new UnauthorizedException('Ungültige Zugangsdaten.');
    }

    if (user.failedLoginAttempts > 0) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { failedLoginAttempts: 0 },
      });
    }

    const payload: LicenseRecoveryPayload = {
      sub: user.id,
      purpose: 'license-recovery',
    };
    return this.jwt.signAsync(payload, {
      secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
      expiresIn: Math.floor(LICENSE_RECOVERY_TOKEN_TTL_MS / 1000),
    });
  }

  /** Schritt 2: der Key wird erst nach einem gültigen Token aus Schritt 1
   * übernommen. Löst danach sofort einen echten Re-Check aus, damit die
   * Installation ohne Neustart wieder entsperrt, sobald der Key stimmt. */
  async applyRecoveryKey(
    recoveryToken: string,
    apiKey: string,
  ): Promise<JobOutcome> {
    let payload: LicenseRecoveryPayload;
    try {
      payload = await this.jwt.verifyAsync<LicenseRecoveryPayload>(
        recoveryToken,
        { secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET') },
      );
    } catch {
      throw new UnauthorizedException(
        'Sitzung abgelaufen. Bitte erneut anmelden.',
      );
    }
    if (payload.purpose !== 'license-recovery') {
      throw new UnauthorizedException('Token ungültig.');
    }

    await this.settingsService.updateLicenseClientSettings(
      { apiKey },
      payload.sub,
    );
    return this.performCheck();
  }
}
