import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
  UnauthorizedException,
} from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@pivot/database';
import { PrismaService } from '../prisma/prisma.service';
import {
  decryptSecret,
  encryptSecret,
} from '../common/utils/secret-encryption';
import { CreateWebsiteDto } from './dto/create-website.dto';
import { UpdateWebsiteDto } from './dto/update-website.dto';
import { QueryWebsiteDto } from './dto/query-website.dto';
import {
  signLicenseToken,
  type LicenseTokenPayload,
} from './license-token.util';
import { getAppVersion } from '../common/utils/app-version';

export interface WebsiteCheckItem {
  label: string;
  ok: boolean;
  /** Rechtsbündiger Detail-Text im Prüf-Popup (Nutzervorgabe, 2026-08-26,
   * 1:1 nach Bildvorlage: "148 ms Antwortzeit", "Schlüssel gültig",
   * "Abweichung seit ...", "freigegeben" usw.) – bewusst nur echte,
   * tatsächlich gemessene/verglichene Werte, keine erfundenen Daten. */
  detail?: string;
}

// 14 Tage Gültigkeit bei wöchentlichem Abruf – 1-2 verpasste Zyklen Puffer,
// bevor eine Nichterreichbarkeit des Masters überhaupt relevant wird (siehe
// knowledge-base/platform/master-slave-licensing.md).
const TOKEN_VALIDITY_MS = 14 * 24 * 60 * 60 * 1000;

// Nutzervorgabe, 2026-08-25: "Entwicklermodus wird nach spätestens 3 Tagen
// automatisch gesperrt, bis zur Reaktivierung" – siehe
// autoLockStaleDevelopmentSites() unten. Exportiert, damit
// LicenseClientService.getEffectiveStatus() denselben Wert für die
// "wird gesperrt am ..."-Anzeige im Client-Toast verwenden kann, statt
// die Frist ein zweites Mal fest zu verdrahten.
export const DEVELOPMENT_MODE_MAX_DAYS = 3;

// `JobRun.jobId` für autoLockStaleDevelopmentSites() – taucht in "Letzte
// Läufe" auf, aber bewusst NICHT in JobsService.definitions: dieser Job
// setzt eine Sicherheitsgrenze durch (verhindert dauerhaft von der
// Lizenzprüfung ausgenommene Installationen), ein pausierbarer/umplanbarer
// Eintrag würde genau das untergraben – gleiches Prinzip wie
// LICENSE_CHECK_JOB_ID/WEBSITE_MONITOR_JOB_ID.
export const DEVELOPMENT_MODE_AUTOLOCK_JOB_ID = 'development-mode-autolock';

function generateApiKey(): string {
  return randomBytes(32).toString('hex');
}

// Öffentlich anzeigbare Felder – nie `apiKeyEncrypted` (nur über den
// dedizierten `revealApiKey()`-Weg entschlüsselt ausgeliefert, nicht
// beiläufig in jeder Listen-Antwort).
const PUBLIC_SELECT = {
  id: true,
  name: true,
  domain: true,
  status: true,
  deploymentMode: true,
  testUrl: true,
  lastCheckInAt: true,
  lastWakeupAt: true,
  lastWakeupOk: true,
  lastWakeupMessage: true,
  lastReportedVersion: true,
  lastReportedLicenseStatus: true,
  lastCheckChecks: true,
  createdAt: true,
  updatedAt: true,
  mandantId: true,
  mandant: { select: { id: true, name: true } },
} as const;

@Injectable()
export class WebsitesService implements OnModuleInit {
  private readonly logger = new Logger(WebsitesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  /** Backfill für Installationen, die schon vor diesem Feature im
   * Entwicklungsmodus liefen (Nutzervorgabe, 2026-08-25) – ohne diesen
   * Lauf hätten sie `developmentModeSince: null` und würden dadurch NIE
   * automatisch gesperrt (der Cron-Job unten filtert nur auf gesetzte,
   * abgelaufene Zeitstempel). Startet die 3-Tage-Frist für sie ab jetzt,
   * statt sie rückwirkend zu bestrafen oder dauerhaft zu verschonen. */
  async onModuleInit() {
    await this.prisma.website.updateMany({
      where: { status: 'development', developmentModeSince: null },
      data: { developmentModeSince: new Date() },
    });
  }

  /** Nutzervorgabe, 2026-08-25: "baue es so, dass Entwicklermodus immer
   * nach spätestens 3 Tagen gesperrt wird, bis zur Reaktivierung" – der
   * Entwicklungsmodus ist bewusst von der Lizenzprüfung ausgenommen (siehe
   * LicenseClientService.getEffectiveStatus()), soll aber kein dauerhafter,
   * vergessbarer Freifahrtschein werden. Läuft täglich, sperrt über
   * `update()` (löst automatisch das Wecken/die Client-Benachrichtigung
   * aus, siehe dortiger Kommentar) statt eines rohen `updateMany()`. */
  @Cron('0 3 * * *')
  async autoLockStaleDevelopmentSites() {
    const startedAt = new Date();
    const cutoff = new Date(
      startedAt.getTime() - DEVELOPMENT_MODE_MAX_DAYS * 24 * 60 * 60 * 1000,
    );
    const staleSites = await this.prisma.website.findMany({
      where: { status: 'development', developmentModeSince: { lte: cutoff } },
      select: { id: true, name: true },
    });
    // Performance-Selbstbefund, 2026-08-25: parallel statt sequenziell,
    // gleiches Muster wie checkAllWebsites() – sonst würde eine einzelne
    // unerreichbare Installation (10s Timeout im Wecken-Versuch) alle
    // nachfolgenden fälligen Sperren unnötig verzögern.
    await Promise.all(
      staleSites.map(async (site) => {
        try {
          await this.update(site.id, { status: 'locked' });
        } catch (error) {
          this.logger.warn(
            `Automatische Sperre für "${site.name}" fehlgeschlagen: ${(error as Error).message}`,
          );
        }
      }),
    );
    await this.prisma.scheduledJob.upsert({
      where: { id: DEVELOPMENT_MODE_AUTOLOCK_JOB_ID },
      create: {
        id: DEVELOPMENT_MODE_AUTOLOCK_JOB_ID,
        cronExpression: '0 3 * * *',
        isCritical: true,
      },
      update: {},
    });
    await this.prisma.jobRun.create({
      data: {
        jobId: DEVELOPMENT_MODE_AUTOLOCK_JOB_ID,
        startedAt,
        durationMs: Date.now() - startedAt.getTime(),
        status: 'success',
        message:
          staleSites.length === 0
            ? 'Keine Installation über der 3-Tage-Frist im Entwicklungsmodus.'
            : `${staleSites.length} Installation(en) automatisch gesperrt: ${staleSites.map((s) => s.name).join(', ')}.`,
      },
    });
  }

  // Gleicher app-weiter AES-256-GCM-Schlüssel wie TOTP-Secrets/SMTP-
  // Passwort (siehe common/utils/secret-encryption.ts).
  private getEncryptionKey(): string {
    return this.config.getOrThrow<string>('TOTP_ENCRYPTION_KEY');
  }

  async findAll(query: QueryWebsiteDto) {
    const { page, pageSize } = query;
    const [items, total] = await Promise.all([
      this.prisma.website.findMany({
        orderBy: { name: 'asc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: PUBLIC_SELECT,
      }),
      this.prisma.website.count(),
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

  private async assertDomainFree(domain: string, excludeId?: string) {
    const existing = await this.prisma.website.findUnique({
      where: { domain },
    });
    if (existing && existing.id !== excludeId) {
      throw new ConflictException(
        `Für die Domain „${domain}“ existiert bereits eine Website.`,
      );
    }
  }

  /** Der Klartext-API-Key wird hier direkt zurückgegeben (zusätzlich über
   * `revealApiKey()` jederzeit erneut abrufbar, siehe dort). */
  async create(dto: CreateWebsiteDto) {
    await this.assertDomainFree(dto.domain);
    const apiKey = generateApiKey();
    const apiKeyEncrypted = encryptSecret(apiKey, this.getEncryptionKey());
    const website = await this.prisma.website.create({
      data: {
        name: dto.name,
        domain: dto.domain,
        apiKeyEncrypted,
        mandantId: dto.mandantId,
      },
      select: PUBLIC_SELECT,
    });
    return { ...website, apiKey };
  }

  /** Nutzer-Bugreport, 2026-08-25: "Seite wird nicht in den Wartungsmodus
   * gesetzt" – Status ändern (z.B. auf "Gesperrt") schrieb bisher nur die
   * Master-eigene `Website.status`-Spalte, ohne die Installation davon zu
   * unterrichten. Die Änderung wurde dadurch erst beim nächsten
   * eigenständigen Check der Installation wirksam (Stunden bis eine Woche
   * später) – und bis dahin zeigte die Kachel weiterhin den alten, jetzt
   * widersprüchlich wirkenden "OK"-Stand aus `lastWakeup*` an ("sagt, alles
   * passt, obwohl oben Gesperrt steht"). Löst bei einer Status-Änderung
   * jetzt automatisch ein "Wecken" aus (siehe `wakeup()`), damit die
   * Änderung sofort wirkt UND die Kachel sofort den echten, aktuellen
   * Stand zeigt statt einen veralteten. */
  async update(id: string, dto: UpdateWebsiteDto) {
    const website = await this.prisma.website.findUnique({ where: { id } });
    if (!website) {
      throw new NotFoundException(`Website ${id} nicht gefunden.`);
    }
    if (dto.domain) {
      await this.assertDomainFree(dto.domain, id);
    }
    // Nutzervorgabe, 2026-08-25: "Entwicklermodus wird nach spätestens 3
    // Tagen automatisch gesperrt" – der Zeitstempel startet nur bei einem
    // echten Wechsel IN "development" neu und wird beim Verlassen wieder
    // gelöscht, siehe autoLockStaleDevelopmentSites() und der Kommentar am
    // Feld in schema.prisma.
    const enteringDevelopment =
      dto.status === 'development' && website.status !== 'development';
    const leavingDevelopment =
      dto.status &&
      dto.status !== 'development' &&
      website.status === 'development';
    await this.prisma.website.update({
      where: { id },
      data: {
        name: dto.name,
        domain: dto.domain,
        status: dto.status,
        deploymentMode: dto.deploymentMode,
        testUrl: dto.testUrl,
        ...(enteringDevelopment && { developmentModeSince: new Date() }),
        ...(leavingDevelopment && { developmentModeSince: null }),
      },
    });
    if (dto.status && dto.status !== website.status) {
      await this.wakeup(id);
    }
    return this.prisma.website.findUniqueOrThrow({
      where: { id },
      select: PUBLIC_SELECT,
    });
  }

  async remove(id: string) {
    await this.prisma.website.delete({ where: { id } });
  }

  /** Für den Fall, dass ein API-Key kompromittiert wurde – gibt den neuen
   * Klartext-Key zurück und invalidiert den bisherigen sofort. */
  async regenerateApiKey(id: string) {
    const website = await this.prisma.website.findUnique({ where: { id } });
    if (!website) {
      throw new NotFoundException(`Website ${id} nicht gefunden.`);
    }
    const apiKey = generateApiKey();
    const apiKeyEncrypted = encryptSecret(apiKey, this.getEncryptionKey());
    await this.prisma.website.update({
      where: { id },
      data: { apiKeyEncrypted },
    });
    return { apiKey };
  }

  /** Nutzervorgabe, 2026-08-24: "ich will mir den Key immer mit Icon
   * anzeigen lassen" – entschlüsselt den gespeicherten Key auf Anfrage
   * (nur bei explizitem Klick im Frontend, nicht Teil der normalen
   * Listen-Antwort). Bekannter Sicherheits-Trade-off dokumentiert in
   * knowledge-base/platform/master-slave-licensing.md. */
  async revealApiKey(id: string): Promise<{ apiKey: string }> {
    const website = await this.prisma.website.findUnique({
      where: { id },
      select: { apiKeyEncrypted: true },
    });
    if (!website) {
      throw new NotFoundException(`Website ${id} nicht gefunden.`);
    }
    if (!website.apiKeyEncrypted) {
      throw new NotFoundException(
        'Für diese Website ist noch kein Key gespeichert – bitte zuerst neu erzeugen.',
      );
    }
    return {
      apiKey: decryptSecret(website.apiKeyEncrypted, this.getEncryptionKey()),
    };
  }

  /** Nutzervorgabe, 2026-08-24: "können wir das auch einbauen" – ruft bei
   * der Client-Installation `POST /license/wakeup` auf, um ihren eigenen
   * Pull-Check sofort auszulösen, statt auf den wöchentlichen Cron zu
   * warten. Bricht das Pull-Prinzip NICHT: dieser Aufruf trägt keine
   * Autorität, er stößt bei der Installation nur denselben, weiterhin
   * selbst-signierten Vorgang an, den sie auch von sich aus ausführen
   * würde. `testUrl` (siehe schema.prisma) erlaubt das Ansprechen lokaler
   * Testinstallationen, deren Domain nicht wirklich auf sie zeigt.
   *
   * Update 2026-08-24, Nutzer-Feedback ("diese Prüfung sagt nichts aus"):
   * wertet jetzt die ECHTE Antwort der Installation aus (siehe
   * `LicenseStateController.wakeup()` – liefert seit diesem Update
   * `{triggered, outcome}` statt nur eines nackten Erfolgs-Flags) statt nur
   * den HTTP-Status des Aufrufs selbst zu interpretieren. Ein `401`
   * bedeutet konkret "der bei der Installation hinterlegte Key stimmt nicht
   * mehr mit dem hier gespeicherten überein". Persistiert das Ergebnis auf
   * `lastWakeupAt`/`lastWakeupOk`/`lastWakeupMessage`, damit es auf der
   * Kachel sichtbar bleibt, nicht nur als flüchtiger Toast. */
  async wakeup(id: string): Promise<{
    ok: boolean;
    message: string;
    version: string | null;
    licenseStatus: string | null;
    checks: WebsiteCheckItem[];
  }> {
    const website = await this.prisma.website.findUnique({ where: { id } });
    if (!website) {
      throw new NotFoundException(`Website ${id} nicht gefunden.`);
    }
    const result = await this.performWakeup(website);
    await this.prisma.website.update({
      where: { id },
      data: {
        lastWakeupAt: new Date(),
        lastWakeupOk: result.ok,
        lastWakeupMessage: result.message,
        lastCheckChecks: result.checks as unknown as Prisma.InputJsonValue,
        // Nur überschreiben, wenn tatsächlich etwas gemeldet wurde – ein
        // Fehlschlag (Timeout, falscher Key) soll den zuletzt bekannten
        // Stand nicht auf "unbekannt" zurücksetzen.
        ...(result.version ? { lastReportedVersion: result.version } : {}),
        ...(result.licenseStatus
          ? { lastReportedLicenseStatus: result.licenseStatus }
          : {}),
      },
    });
    return result;
  }

  /** Nutzervorgabe, 2026-08-25: "gib in der Prüfung an, ob Version aktuell
   * ist, schreibe alle Prüfungen untereinander, die OK sind mit Haken, die
   * nicht OK mit X" – liefert statt einer einzelnen Erfolgsmeldung eine
   * Liste einzelner, ehrlicher Teilergebnisse (Erreichbarkeit, API-Key,
   * Prüfungslauf, Versionsstand). Nutzervorgabe, 2026-08-25: "immer alle
   * Punkte angeben ... nicht weglassen, wenn Hinweise da sind" – ALLE vier
   * Checks stehen immer in der Liste, auch wenn ein früher Fehlschlag
   * (z.B. Timeout) sie eigentlich gar nicht mehr prüfen konnte. In dem Fall
   * gilt: nicht zweifelsfrei bestätigt = X, nicht "ausgelassen". */
  private async performWakeup(website: {
    id: string;
    apiKeyEncrypted: string | null;
    domain: string;
    testUrl: string | null;
  }): Promise<{
    ok: boolean;
    message: string;
    version: string | null;
    licenseStatus: string | null;
    checks: WebsiteCheckItem[];
  }> {
    const checks: WebsiteCheckItem[] = [
      { label: 'Erreichbar', ok: false },
      { label: 'API-Zugang', ok: false },
      { label: 'Version', ok: false },
      { label: 'Suchmaschinen', ok: false },
    ];

    if (!website.apiKeyEncrypted) {
      return {
        ok: false,
        message: 'Kein API-Key hinterlegt.',
        version: null,
        licenseStatus: null,
        checks,
      };
    }
    const apiKey = decryptSecret(
      website.apiKeyEncrypted,
      this.getEncryptionKey(),
    );
    const baseUrl = (website.testUrl ?? `https://${website.domain}`).replace(
      /\/$/,
      '',
    );

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    // Nutzervorgabe, 2026-08-26: "148 ms Antwortzeit" im Prüf-Popup – echte
    // gemessene Laufzeit des Wakeup-Requests, keine erfundene Zahl.
    const startedAt = Date.now();
    try {
      const res = await fetch(`${baseUrl}/api/license/wakeup`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}` },
        signal: controller.signal,
      });
      const responseMs = Date.now() - startedAt;
      if (res.status === 401) {
        checks[0].ok = true;
        checks[0].detail = `${responseMs} ms Antwortzeit`;
        checks[1].detail = 'Schlüssel ungültig';
        return {
          ok: false,
          message:
            'Der bei der Installation hinterlegte API-Key stimmt nicht mehr mit dem hier gespeicherten überein.',
          version: null,
          licenseStatus: null,
          checks,
        };
      }
      if (!res.ok) {
        checks[0].ok = true;
        checks[0].detail = `${responseMs} ms Antwortzeit`;
        return {
          ok: false,
          message: `Installation antwortete mit HTTP ${res.status}.`,
          version: null,
          licenseStatus: null,
          checks,
        };
      }
      const data = (await res.json().catch(() => null)) as {
        outcome?: {
          status: 'success' | 'error';
          message: string;
          licenseStatus?: 'live' | 'development' | 'locked';
        };
        version?: string;
      } | null;
      const version = data?.version ?? null;
      const licenseStatus = data?.outcome?.licenseStatus ?? null;
      const currentVersion = getAppVersion();

      checks[0].ok = true;
      checks[0].detail = `${responseMs} ms Antwortzeit`;
      checks[1].ok = true;
      checks[1].detail = 'Schlüssel gültig';
      checks[2].ok = version !== null && version === currentVersion;
      // Nutzervorgabe, 2026-08-27: die installierte Version steht schon
      // oben im Popup-Kopf (Badge "Pivot {lastReportedVersion}") – hier
      // nur noch das Ergebnis des Vergleichs, ohne Versions-Wiederholung.
      checks[2].detail = version
        ? checks[2].ok
          ? 'aktuell'
          : `Update verfügbar (${currentVersion})`
        : 'veraltet';
      // "Suchmaschinen": echter Live-Check der robots.txt der Installation
      // (Nutzervorgabe, 2026-08-26) – kein erfundener Wert, sondern eine
      // tatsächliche zweite Anfrage. Ein pauschales "Disallow: /" für alle
      // Bots gilt als blockiert, alles andere (inkl. keine robots.txt) als
      // freigegeben.
      try {
        const robotsRes = await fetch(`${baseUrl}/robots.txt`, {
          signal: controller.signal,
        });
        if (robotsRes.ok) {
          const robotsText = await robotsRes.text();
          const blocked =
            /user-agent:\s*\*[\s\S]*?disallow:\s*\/\s*(\n|$)/i.test(robotsText);
          checks[3].ok = !blocked;
          checks[3].detail = blocked ? 'blockiert' : 'freigegeben';
        } else {
          checks[3].ok = true;
          checks[3].detail = 'freigegeben';
        }
      } catch {
        checks[3].ok = true;
        checks[3].detail = 'freigegeben';
      }

      // Nutzervorgabe, 2026-08-25: "wenn eines der Checks nicht OK ist, soll
      // Hinweis-Alert kommen, OK nur, wenn alles passt" – das Gesamtergebnis
      // ist NICHT mehr nur der Erfolg des Prüfungslaufs selbst
      // (`outcome.status`), sondern ehrlich UND aus allen Teilergebnissen,
      // damit die Kachel (die nur `ok` sieht, siehe websites-view.tsx) nicht
      // "OK" zeigt, während im Detail-Popup ein "X" steht.
      const ok = checks.every((check) => check.ok);
      return {
        ok,
        message: data?.outcome?.message ?? 'Installation wurde geweckt.',
        version,
        licenseStatus,
        checks,
      };
    } catch {
      return {
        ok: false,
        message: 'Installation nicht erreichbar.',
        version: null,
        licenseStatus: null,
        checks,
      };
    } finally {
      clearTimeout(timeout);
    }
  }

  /** "Prüfen"-Button (Nutzervorgabe, 2026-08-24: "wenn ich bei Pivot Master
   * prüfe, sollen alle Webseiten einmal durchlaufen werden und den Status
   * ausgeben, der gerade ist") – weckt JEDE Website (nicht nur gesperrte,
   * anders als `WebsiteMonitorService`s Live-Check) und meldet das
   * tatsächliche Ergebnis pro Installation zurück, nicht nur eine
   * allgemeine Erfolgsmeldung. */
  async checkAllWebsites(): Promise<{
    checkedAt: string;
    results: {
      id: string;
      name: string;
      domain: string;
      ok: boolean;
      message: string;
      version: string | null;
      licenseStatus: string | null;
      checks: WebsiteCheckItem[];
    }[];
  }> {
    const sites = await this.prisma.website.findMany({
      select: {
        id: true,
        name: true,
        domain: true,
        apiKeyEncrypted: true,
        testUrl: true,
      },
    });
    const checkedAt = new Date();
    const results = await Promise.all(
      sites.map(async (site) => {
        const result = await this.performWakeup(site);
        await this.prisma.website.update({
          where: { id: site.id },
          data: {
            lastWakeupAt: checkedAt,
            lastWakeupOk: result.ok,
            lastWakeupMessage: result.message,
            lastCheckChecks: result.checks as unknown as Prisma.InputJsonValue,
            ...(result.version ? { lastReportedVersion: result.version } : {}),
            ...(result.licenseStatus
              ? { lastReportedLicenseStatus: result.licenseStatus }
              : {}),
          },
        });
        return {
          id: site.id,
          name: site.name,
          domain: site.domain,
          ok: result.ok,
          message: result.message,
          version: result.version,
          licenseStatus: result.licenseStatus,
          checks: result.checks,
        };
      }),
    );
    return { checkedAt: checkedAt.toISOString(), results };
  }

  /**
   * Pull-Endpunkt für Slave-Installationen (siehe
   * knowledge-base/platform/master-slave-licensing.md). Bewusst derselbe
   * generische 401 für "Domain unbekannt" UND "falscher Key" – verhindert,
   * dass sich über diesen öffentlichen Endpunkt registrierte Domains
   * erraten lassen. Konstante Vergleichszeit (`timingSafeEqual`) statt
   * `===`, damit kein Timing-Seitenkanal auf den Key-Inhalt schließen
   * lässt (frühere Argon2-`verify()` bot das automatisch mit).
   */
  async checkLicense(
    domain: string,
    apiKey: string,
  ): Promise<{ token: string }> {
    const website = await this.prisma.website.findUnique({
      where: { domain },
      include: {
        mandant: { include: { modules: { select: { moduleKey: true } } } },
      },
    });
    if (!website?.apiKeyEncrypted) {
      throw new UnauthorizedException('Ungültige Zugangsdaten.');
    }

    let isValid = false;
    try {
      const expected = Buffer.from(
        decryptSecret(website.apiKeyEncrypted, this.getEncryptionKey()),
        'utf8',
      );
      const actual = Buffer.from(apiKey, 'utf8');
      isValid =
        expected.length === actual.length && timingSafeEqual(expected, actual);
    } catch {
      isValid = false;
    }
    if (!isValid) {
      throw new UnauthorizedException('Ungültige Zugangsdaten.');
    }

    const seq = website.lastSeq + 1;
    const issuedAt = Date.now();
    const payload: LicenseTokenPayload = {
      domain: website.domain,
      siteId: website.id,
      status: website.status as LicenseTokenPayload['status'],
      issuedAt,
      expiresAt: issuedAt + TOKEN_VALIDITY_MS,
      seq,
      developmentModeSince: website.developmentModeSince?.getTime() ?? null,
      modules: website.mandant.modules.map((entry) => entry.moduleKey),
    };
    const token = signLicenseToken(payload);

    await this.prisma.website.update({
      where: { id: website.id },
      data: { lastSeq: seq, lastCheckInAt: new Date() },
    });

    return { token };
  }
}
