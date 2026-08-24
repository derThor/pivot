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
  lastCheckInAt: true,
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
