import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { UsersService } from '../users/users.service';
import { ContentService } from '../content/content.service';
import { MediaService } from '../media/media.service';
import { CategoriesService } from '../categories/categories.service';
import { TagsService } from '../tags/tags.service';
import { LegalDocumentsService } from '../legal-documents/legal-documents.service';

function monthsAgo(n: number): Date {
  const d = new Date();
  d.setMonth(d.getMonth() - n);
  return d;
}

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

@Injectable()
export class PrivacyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
    private readonly auditLog: AuditLogService,
    private readonly users: UsersService,
    private readonly content: ContentService,
    private readonly media: MediaService,
    private readonly categories: CategoriesService,
    private readonly tags: TagsService,
    private readonly legalDocuments: LegalDocumentsService,
  ) {}

  private async cutoffs() {
    const settings = await this.settings.get();
    return {
      accessLog: monthsAgo(settings.retentionAccessLogMonths),
      deactivatedAccounts: monthsAgo(settings.retentionDeactivatedAccountsMonths),
      trash: daysAgo(settings.retentionTrashDays),
    };
  }

  async findAccessLogDue() {
    const { accessLog } = await this.cutoffs();
    return this.auditLog.findOlderThan(accessLog);
  }

  async deleteAccessLogEntry(id: string) {
    await this.auditLog.deleteMany([id]);
  }

  async deleteAllAccessLogDue() {
    const due = await this.findAccessLogDue();
    await this.auditLog.deleteMany(due.map((entry) => entry.id));
    return { deleted: due.length };
  }

  async findDeactivatedAccountsDue() {
    const { deactivatedAccounts } = await this.cutoffs();
    return this.users.findDeactivatedOlderThan(deactivatedAccounts);
  }

  async findTrashDue() {
    const { trash } = await this.cutoffs();
    const [content, media, categories, tags] = await Promise.all([
      this.content.findTrashedOlderThan(trash),
      this.media.findTrashedOlderThan(trash),
      this.categories.findTrashedOlderThan(trash),
      this.tags.findTrashedOlderThan(trash),
    ]);
    return {
      content: content.map((c) => ({ id: c.id, label: c.title, deletedAt: c.deletedAt })),
      media: media.map((m) => ({ id: m.id, label: m.filename, deletedAt: m.deletedAt })),
      categories: categories.map((c) => ({ id: c.id, label: c.name, deletedAt: c.deletedAt })),
      tags: tags.map((t) => ({ id: t.id, label: t.name, deletedAt: t.deletedAt })),
    };
  }

  /** Baut den CSV-Bericht aus denselben Zählungen, die auch die
   * Kopf-Statistiken der Datenschutz-Seite speisen – keine separate
   * Datenquelle nur für den Export. */
  async generateReportCsv(): Promise<string> {
    const [
      deletionRequestsOpen,
      legalDocuments,
      processingActivitiesCount,
      dataProcessorsTotal,
      dataProcessorsWithContract,
      incidentsTotal,
      incidentsOpen,
      accessLogDue,
      deactivatedDue,
      trash,
    ] = await Promise.all([
      this.prisma.deletionRequest.count({ where: { status: 'open' } }),
      this.legalDocuments.findAll(),
      this.prisma.processingActivity.count(),
      this.prisma.dataProcessor.count(),
      this.prisma.dataProcessor.count({ where: { hasContract: true } }),
      this.prisma.privacyIncident.count(),
      this.prisma.privacyIncident.count({ where: { status: 'open' } }),
      this.findAccessLogDue(),
      this.findDeactivatedAccountsDue(),
      this.findTrashDue(),
    ]);

    const legalStale = legalDocuments.filter((d) => d.status === 'stale').length;
    const legalMissing = legalDocuments.filter((d) => d.status === 'missing').length;
    const trashTotal =
      trash.content.length + trash.media.length + trash.categories.length + trash.tags.length;

    const rows: [string, string, string][] = [
      ['Löschanfragen', 'Offen', String(deletionRequestsOpen)],
      ['Rechtstexte', 'Veraltet', String(legalStale)],
      ['Rechtstexte', 'Fehlend', String(legalMissing)],
      ['Verarbeitungen', 'Erfasste Zwecke', String(processingActivitiesCount)],
      ['Auftragsverarbeiter', 'Gesamt', String(dataProcessorsTotal)],
      ['Auftragsverarbeiter', 'Mit AV-Vertrag', String(dataProcessorsWithContract)],
      ['Vorfälle', 'Gesamt', String(incidentsTotal)],
      ['Vorfälle', 'Offen', String(incidentsOpen)],
      ['Aufbewahrung', 'Zugriffsprotokoll fällig zur Löschung', String(accessLogDue.length)],
      ['Aufbewahrung', 'Deaktivierte Konten fällig zur Löschung', String(deactivatedDue.length)],
      ['Aufbewahrung', 'Papierkorb fällig zur Löschung', String(trashTotal)],
    ];

    const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const header = 'Bereich,Kennzahl,Wert';
    const lines = rows.map((r) => r.map(escape).join(','));
    return [header, ...lines].join('\n');
  }
}
