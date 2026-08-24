import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { ConfigService } from '@nestjs/config';
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

// 14 Tage Gültigkeit bei wöchentlichem Abruf – 1-2 verpasste Zyklen Puffer,
// bevor eine Nichterreichbarkeit des Masters überhaupt relevant wird (siehe
// knowledge-base/platform/master-slave-licensing.md).
const TOKEN_VALIDITY_MS = 14 * 24 * 60 * 60 * 1000;

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
  createdAt: true,
  updatedAt: true,
} as const;

@Injectable()
export class WebsitesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

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
      data: { name: dto.name, domain: dto.domain, apiKeyEncrypted },
      select: PUBLIC_SELECT,
    });
    return { ...website, apiKey };
  }

  async update(id: string, dto: UpdateWebsiteDto) {
    const website = await this.prisma.website.findUnique({ where: { id } });
    if (!website) {
      throw new NotFoundException(`Website ${id} nicht gefunden.`);
    }
    if (dto.domain) {
      await this.assertDomainFree(dto.domain, id);
    }
    return this.prisma.website.update({
      where: { id },
      data: {
        name: dto.name,
        domain: dto.domain,
        status: dto.status,
        deploymentMode: dto.deploymentMode,
        testUrl: dto.testUrl,
      },
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
  async wakeup(id: string): Promise<{ ok: boolean; message: string }> {
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
      },
    });
    return result;
  }

  private async performWakeup(website: {
    id: string;
    apiKeyEncrypted: string | null;
    domain: string;
    testUrl: string | null;
  }): Promise<{ ok: boolean; message: string }> {
    if (!website.apiKeyEncrypted) {
      return { ok: false, message: 'Kein API-Key hinterlegt.' };
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
    try {
      const res = await fetch(`${baseUrl}/api/license/wakeup`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}` },
        signal: controller.signal,
      });
      if (res.status === 401) {
        return {
          ok: false,
          message:
            'Der bei der Installation hinterlegte API-Key stimmt nicht mehr mit dem hier gespeicherten überein.',
        };
      }
      if (!res.ok) {
        return {
          ok: false,
          message: `Installation antwortete mit HTTP ${res.status}.`,
        };
      }
      const data = (await res.json().catch(() => null)) as {
        outcome?: { status: 'success' | 'error'; message: string };
      } | null;
      if (data?.outcome) {
        return {
          ok: data.outcome.status === 'success',
          message: data.outcome.message,
        };
      }
      return { ok: true, message: 'Installation wurde geweckt.' };
    } catch {
      return { ok: false, message: 'Installation nicht erreichbar.' };
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
          },
        });
        return {
          id: site.id,
          name: site.name,
          domain: site.domain,
          ok: result.ok,
          message: result.message,
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
    };
    const token = signLicenseToken(payload);

    await this.prisma.website.update({
      where: { id: website.id },
      data: { lastSeq: seq, lastCheckInAt: new Date() },
    });

    return { token };
  }
}
