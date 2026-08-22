import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Prisma } from '@pivot/database';
import { PrismaService } from '../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { UpdateLegalDocumentDto } from './dto/update-legal-document.dto';

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

type CompanyFields = {
  companyName: string | null;
  companyStreet: string | null;
  companyPostalCode: string | null;
  companyCity: string | null;
  companyCountry: string | null;
  companyRepresentative: string | null;
  companyEmail: string | null;
  companyPhone: string | null;
  companyRegisterCourt: string | null;
  companyRegisterNumber: string | null;
  companyVatId: string | null;
  companySupervisoryAuthority: string | null;
  companyDisputeResolution: string | null;
  // Datenschutzbeauftragter-Absatz (Nutzervorgabe, 2026-08-18): wirkt nur,
  // wenn dpoListInLegalTexts aktiv ist UND ein Name/Firma hinterlegt ist –
  // kein reiner Anzeige-Schalter, siehe LegalDocumentsService.
  dpoListInLegalTexts: boolean;
  dpoName: string | null;
  dpoCompany: string | null;
  dpoEmail: string | null;
  dpoPhone: string | null;
};

function addressLine(c: CompanyFields): string {
  return [c.companyStreet, [c.companyPostalCode, c.companyCity].filter(Boolean).join(' '), c.companyCountry]
    .filter(Boolean)
    .join(', ');
}

function dpoLine(c: CompanyFields): string | null {
  if (!c.dpoListInLegalTexts) return null;
  const who = [c.dpoName, c.dpoCompany].filter(Boolean).join(', ');
  if (!who && !c.dpoEmail) return null;
  const contact = [who, c.dpoEmail, c.dpoPhone].filter(Boolean).join(' · ');
  return `Datenschutzbeauftragter: ${contact}`;
}

// Reine Textbausteine aus den Firmen-Stammdaten (AppSettings.company*) –
// keine echte Rechtsberatung/vollständige Rechtstexte, sondern eine
// Demonstration des "aus Stammdaten generiert"-Mechanismus (Nutzervorgabe,
// 2026-08-18). Fehlende Felder werden ausgelassen statt Platzhalter wie
// "[nicht angegeben]" zu erzeugen.
const TEMPLATES: Record<string, { title: string; slug: string; generate: (c: CompanyFields) => string }> = {
  impressum: {
    title: 'Impressum',
    slug: '/impressum',
    generate: (c) => {
      const lines = ['Angaben gemäß § 5 TMG', ''];
      if (c.companyName) lines.push(c.companyName);
      if (addressLine(c)) lines.push(addressLine(c));
      lines.push('');
      if (c.companyRepresentative)
        lines.push(`Vertretungsberechtigt: ${c.companyRepresentative}`);
      if (c.companyEmail) lines.push(`E-Mail: ${c.companyEmail}`);
      if (c.companyPhone) lines.push(`Telefon: ${c.companyPhone}`);
      if (c.companyRegisterCourt || c.companyRegisterNumber) {
        lines.push('');
        if (c.companyRegisterCourt) lines.push(`Registergericht: ${c.companyRegisterCourt}`);
        if (c.companyRegisterNumber) lines.push(`Registernummer: ${c.companyRegisterNumber}`);
      }
      if (c.companyVatId) lines.push(`USt-IdNr.: ${c.companyVatId}`);
      if (c.companySupervisoryAuthority)
        lines.push(`Aufsichtsbehörde: ${c.companySupervisoryAuthority}`);
      if (c.companyDisputeResolution)
        lines.push('', `Streitschlichtung: ${c.companyDisputeResolution}`);
      const dpo = dpoLine(c);
      if (dpo) lines.push('', dpo);
      return lines.join('\n');
    },
  },
  datenschutz: {
    title: 'Datenschutzerklärung',
    slug: '/datenschutz',
    generate: (c) => {
      const lines = ['Verantwortlicher im Sinne der DSGVO', ''];
      if (c.companyName) lines.push(c.companyName);
      if (addressLine(c)) lines.push(addressLine(c));
      if (c.companyEmail) lines.push(`E-Mail: ${c.companyEmail}`);
      const dpo = dpoLine(c);
      if (dpo) lines.push('', dpo);
      lines.push(
        '',
        'Diese Datenschutzerklärung informiert über Art, Umfang und Zweck der Verarbeitung personenbezogener Daten innerhalb unseres Angebots.',
      );
      return lines.join('\n');
    },
  },
  cookies: {
    title: 'Cookie-Hinweis',
    slug: '/cookies',
    generate: (c) => {
      const lines: string[] = [];
      lines.push(
        `Diese Website${c.companyName ? ` von ${c.companyName}` : ''} verwendet Cookies, um grundlegende Funktionen bereitzustellen.`,
      );
      if (c.companyEmail)
        lines.push(`Fragen zum Einsatz von Cookies richten Sie bitte an: ${c.companyEmail}`);
      return lines.join('\n');
    },
  },
  agb: {
    title: 'Allgemeine Geschäftsbedingungen',
    slug: '/agb',
    generate: (c) => {
      const lines = ['Allgemeine Geschäftsbedingungen', ''];
      if (c.companyName) lines.push(`Anbieter: ${c.companyName}`);
      if (addressLine(c)) lines.push(addressLine(c));
      lines.push(
        '',
        'Es gelten die nachfolgenden Bedingungen für alle über dieses Angebot geschlossenen Verträge.',
      );
      return lines.join('\n');
    },
  },
  barrierefreiheit: {
    title: 'Barrierefreiheitserklärung',
    slug: '/barrierefreiheit',
    generate: (c) => {
      const lines: string[] = [];
      lines.push(
        `${c.companyName ?? 'Wir'} ${c.companyName ? 'ist' : 'sind'} bemüht, dieses Angebot im Einklang mit den geltenden Vorschriften zur Barrierefreiheit zugänglich zu gestalten.`,
      );
      if (c.companyEmail)
        lines.push(`Hinweise zu Barrieren richten Sie bitte an: ${c.companyEmail}`);
      return lines.join('\n');
    },
  },
};

export const LEGAL_DOCUMENT_KEYS = Object.keys(TEMPLATES);

@Injectable()
export class LegalDocumentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
    private readonly auditLog: AuditLogService,
  ) {}

  private async companyFields(): Promise<CompanyFields> {
    const settings = await this.settings.get();
    return {
      companyName: settings.companyName,
      companyStreet: settings.companyStreet,
      companyPostalCode: settings.companyPostalCode,
      companyCity: settings.companyCity,
      companyCountry: settings.companyCountry,
      companyRepresentative: settings.companyRepresentative,
      companyEmail: settings.companyEmail,
      companyPhone: settings.companyPhone,
      companyRegisterCourt: settings.companyRegisterCourt,
      companyRegisterNumber: settings.companyRegisterNumber,
      companyVatId: settings.companyVatId,
      companySupervisoryAuthority: settings.companySupervisoryAuthority,
      companyDisputeResolution: settings.companyDisputeResolution,
      dpoListInLegalTexts: settings.dpoListInLegalTexts,
      dpoName: settings.dpoName,
      dpoCompany: settings.dpoCompany,
      dpoEmail: settings.dpoEmail,
      dpoPhone: settings.dpoPhone,
    };
  }

  /** Legt fehlende Rechtstexte-Zeilen einmalig an (Upsert-falls-fehlt statt
   * Prisma-Seed, da es sich um Anwendungsdaten handelt, nicht um
   * Fixture-Daten). */
  private async ensureRows() {
    const existing = await this.prisma.legalDocument.findMany({
      select: { key: true },
    });
    const existingKeys = new Set(existing.map((row) => row.key));
    const missing = LEGAL_DOCUMENT_KEYS.filter((key) => !existingKeys.has(key));
    if (missing.length === 0) return;
    await this.prisma.$transaction(
      missing.map((key) =>
        this.prisma.legalDocument.create({
          data: {
            key,
            title: TEMPLATES[key].title,
            slug: TEMPLATES[key].slug,
            generatedContent: '',
            lastGeneratedAt: null,
          },
        }),
      ),
    );
  }

  /** "Firmendaten geändert" = ein company.field_updated-Audit-Eintrag ist
   * neuer als die letzte Generierung – kein eigenes Staleness-Feld nötig,
   * nutzt die bestehende Audit-Spur (siehe SettingsService.update()). */
  private async isStale(lastGeneratedAt: Date | null): Promise<boolean> {
    if (!lastGeneratedAt) return false;
    const [latest] = await this.auditLog.findRecentForEntity(
      'Company',
      'company',
      1,
    );
    return latest ? latest.createdAt > lastGeneratedAt : false;
  }

  async findAll() {
    await this.ensureRows();
    const rows = await this.prisma.legalDocument.findMany({
      orderBy: { key: 'asc' },
    });
    return Promise.all(
      rows.map(async (row) => {
        const linkedContent =
          row.contentId ?
            await this.prisma.content.findUnique({
              where: { id: row.contentId },
              select: { status: true, deletedAt: true },
            })
          : null;
        // Verknüpfte Seite gelöscht (Papierkorb oder endgültig) → gilt wieder
        // als "fehlt" (Nutzervorgabe, 2026-08-18), inkl. Aufräumen der toten
        // Referenz, damit nicht dauerhaft auf eine Papierkorb-Seite verlinkt
        // bleibt.
        const linkGone = row.contentId != null && (!linkedContent || linkedContent.deletedAt);
        if (linkGone) {
          await this.prisma.legalDocument.update({
            where: { key: row.key },
            data: { contentId: null, lastGeneratedAt: null },
          });
        }
        return {
          ...row,
          contentId: linkGone ? null : row.contentId,
          lastGeneratedAt: linkGone ? null : row.lastGeneratedAt,
          contentStatus: linkGone ? null : (linkedContent?.status ?? null),
          status:
            linkGone || !row.lastGeneratedAt ? ('missing' as const)
            : (await this.isStale(row.lastGeneratedAt)) ? ('stale' as const)
            : ('current' as const),
        };
      }),
    );
  }

  /** Baut aus dem generierten Text + der manuellen Ergänzung den HTML-Body
   * für den Rich-Text-Block der verknüpften Content-Seite – Zeilen werden zu
   * Absätzen, die Ergänzung wird als letzter Absatz angehängt (bleibt so bei
   * jedem "Neu erzeugen" erhalten, ohne den Editor-Inhalt diffen zu müssen). */
  private toHtml(generatedContent: string, manualAddendum: string | null): string {
    const paragraphs = generatedContent
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => `<p>${escapeHtml(line)}</p>`)
      .join('');
    const addendumHtml = manualAddendum ? `<p>${escapeHtml(manualAddendum)}</p>` : '';
    return paragraphs + addendumHtml;
  }

  /** Legt die verknüpfte Content-Seite an oder aktualisiert sie (Nutzervorgabe,
   * 2026-08-18: Rechtstexte sollen auch als echte Seite unter "Seiten"
   * auftauchen). Wiederverwendet den bestehenden ContentType "Seite" +
   * Modul-Typ "Rich-Text" statt einen eigenen Typ nur für 5 Zeilen
   * anzulegen. Kein Public-Routing dahinter – die Seite ist nur im
   * Dashboard sicht-/bearbeitbar (siehe knowledge-base/auth/privacy-page.md). */
  private async syncContentEntry(
    row: { title: string; slug: string; contentId: string | null; manualAddendum: string | null },
    generatedContent: string,
    actingUserId: string,
  ): Promise<string | null> {
    const [contentType, richTextModule] = await Promise.all([
      this.prisma.contentType.findUnique({ where: { slug: 'page' } }),
      this.prisma.moduleType.findUnique({ where: { slug: 'rich-text' } }),
    ]);
    if (!contentType || !richTextModule) return row.contentId;

    const data = {
      blocks: [
        {
          id: randomUUID(),
          moduleTypeId: richTextModule.id,
          values: { content: this.toHtml(generatedContent, row.manualAddendum) },
        },
      ],
    } satisfies Prisma.InputJsonValue;

    if (row.contentId) {
      const existing = await this.prisma.content.findUnique({
        where: { id: row.contentId },
      });
      if (existing) {
        await this.prisma.content.update({
          where: { id: row.contentId },
          data: { title: row.title, data },
        });
        return row.contentId;
      }
    }

    const slug = row.slug.replace(/^\//, '');

    // Ohne (gültige) Verknüpfung kann trotzdem schon eine Seite mit
    // diesem Slug existieren – z.B. wenn die vorherige verknüpfte Seite
    // in den Papierkorb verschoben, aber noch nicht endgültig gelöscht
    // wurde (Slug bleibt beim Soft-Delete belegt, `@@unique([slug,
    // locale])` kennt keinen "nur aktive Zeilen"-Ausschluss). In dem Fall
    // wird dieselbe Zeile wiederbelebt statt einen Duplikat-Fehler zu
    // riskieren – "Erzeugen" nach Papierkorb soll die Seite faktisch
    // wiederherstellen.
    const conflicting = await this.prisma.content.findFirst({
      where: { slug, locale: 'de' },
    });
    if (conflicting) {
      if (!conflicting.deletedAt) {
        throw new ConflictException(
          `Es existiert bereits eine Seite mit dem Slug „${slug}“, die nicht mit diesem Rechtstext verknüpft ist.`,
        );
      }
      await this.prisma.content.update({
        where: { id: conflicting.id },
        data: { title: row.title, data, deletedAt: null },
      });
      return conflicting.id;
    }

    const created = await this.prisma.content.create({
      data: {
        title: row.title,
        slug,
        contentTypeId: contentType.id,
        authorId: actingUserId,
        status: 'DRAFT',
        data,
      },
    });
    return created.id;
  }

  async regenerate(key: string, actingUserId: string) {
    if (!LEGAL_DOCUMENT_KEYS.includes(key)) {
      throw new NotFoundException(`Rechtstext „${key}“ nicht gefunden.`);
    }
    await this.ensureRows();
    const template = TEMPLATES[key];
    const fields = await this.companyFields();
    const generatedContent = template.generate(fields);

    const row = await this.prisma.legalDocument.update({
      where: { key },
      data: { generatedContent, lastGeneratedAt: new Date() },
    });

    const contentId = await this.syncContentEntry(row, generatedContent, actingUserId);
    if (contentId !== row.contentId) {
      return this.prisma.legalDocument.update({ where: { key }, data: { contentId } });
    }
    return row;
  }

  async updateAddendum(key: string, dto: UpdateLegalDocumentDto) {
    const row = await this.prisma.legalDocument.findUnique({ where: { key } });
    if (!row) {
      throw new NotFoundException(`Rechtstext „${key}“ nicht gefunden.`);
    }
    return this.prisma.legalDocument.update({
      where: { key },
      data: { manualAddendum: dto.manualAddendum ?? null },
    });
  }
}
