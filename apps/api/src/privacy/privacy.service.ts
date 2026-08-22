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
import { MailerService } from '../mailer/mailer.service';

function csvEscape(v: string): string {
  return `"${v.replace(/"/g, '""')}"`;
}

// Ohne BOM interpretieren Excel/Windows-Editoren die UTF-8-Datei als
// Windows-1252 und zeigen Umlaute als Mojibake ("AktivitÃ¤tsprotokoll"
// statt "Aktivitätsprotokoll") – Nutzer-Bugreport, 2026-08-19.
const CSV_BOM = '﻿';

/** Deutsche Kurzbeschreibung eines AuditLog-Eintrags für den CSV-Export
 * (Auskunft nach Art. 15 DSGVO) – bewusst eigene, schlankere Kopie von
 * `describeActivity()` in `user-activity-timeline.tsx` (dort React/JSX,
 * hier reiner Text ohne Kategorie-/Akteur-Zeile, da die Auskunft-CSV
 * ohnehin schon eine Datums-Spalte hat). Unbekannte Aktionen fallen auf
 * den rohen Code zurück, wie im Frontend-Pendant. */
function describeAuditAction(
  action: string,
  metadata: Record<string, unknown> | null,
): string {
  const m = metadata ?? {};
  switch (action) {
    case 'user.created':
      return m.method === 'self_registered'
        ? 'Konto erstellt (Selbstregistrierung)'
        : 'Konto erstellt';
    case 'user.role_changed': {
      const roleNames = Array.isArray(m.roleNames)
        ? (m.roleNames as string[]).join(', ')
        : '';
      return `Rolle geändert zu ${roleNames}`;
    }
    case 'user.password_changed':
      return 'Passwort geändert';
    case 'user.2fa_enabled':
      return 'Zwei-Faktor-Authentifizierung aktiviert';
    case 'user.2fa_disabled':
      return 'Zwei-Faktor-Authentifizierung deaktiviert';
    case 'user.impersonate':
      return 'Sitzung durch Administrator übernommen';
    case 'media.uploaded':
      return `Medium hochgeladen${m.filename ? `: ${m.filename}` : ''}`;
    case 'company.field_updated':
      return `Firmendaten geändert: ${String(m.field ?? '')}`;
    case 'content.published':
      return m.title ? `„${m.title}“ veröffentlicht` : 'Inhalt veröffentlicht';
    default:
      return action;
  }
}

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
    private readonly mailer: MailerService,
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

  // Name/Route bewusst unverändert gelassen (nur die Implementierung
  // dahinter zeigt jetzt auf `deletedAt` statt `deactivatedAt`, siehe
  // UsersService.findDeleted) – kein Frontend-Vertragsbruch nötig.
  async findDeactivatedAccountsDue() {
    const { deactivatedAccounts } = await this.cutoffs();
    return this.users.findDeleted(deactivatedAccounts);
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

  /** "Bericht erzeugen" (Kopfleiste der Datenschutz-Seite, Nutzervorgabe
   * 2026-08-20: "bericht bei datenschutz muss alles enthalten, alle tabs
   * in datenschutz") – vollständiger Export über **alle** sechs Tabs
   * (Rechtstexte, Anfragen, Verarbeitungen, Auftragsverarbeiter, Vorfälle,
   * Datenschutzbeauftragter) plus Aufbewahrung, nicht nur Kennzahlen wie
   * zuvor. Jede Zeile ein Datensatz-Feld im etablierten
   * Bereich/Feld/Wert-Muster (siehe `generateSubjectAccessReportCsv`). */
  async generateReportCsv(): Promise<string> {
    const [
      legalDocuments,
      deletionRequests,
      processingActivities,
      dataProcessors,
      incidents,
      settings,
      accessLogDue,
      deactivatedDue,
      trash,
    ] = await Promise.all([
      this.legalDocuments.findAll(),
      this.prisma.deletionRequest.findMany({ orderBy: { createdAt: 'desc' } }),
      this.prisma.processingActivity.findMany({ orderBy: { purpose: 'asc' } }),
      this.prisma.dataProcessor.findMany({ orderBy: { name: 'asc' } }),
      this.prisma.privacyIncident.findMany({ orderBy: { createdAt: 'desc' } }),
      this.settings.get(),
      this.findAccessLogDue(),
      this.findDeactivatedAccountsDue(),
      this.findTrashDue(),
    ]);

    const trashTotal =
      trash.content.length + trash.media.length + trash.categories.length + trash.tags.length;
    const iso = (d: Date | null) => d?.toISOString() ?? '';
    const yn = (b: boolean) => (b ? 'ja' : 'nein');

    const rows: [string, string, string][] = [];

    for (const doc of legalDocuments) {
      rows.push([`Rechtstexte: ${doc.title}`, 'Status', doc.status]);
      rows.push([`Rechtstexte: ${doc.title}`, 'Zuletzt erzeugt', iso(doc.lastGeneratedAt)]);
    }

    for (const r of deletionRequests) {
      const label = `Anfragen: ${r.dsrId}`;
      rows.push([label, 'Art', r.type]);
      rows.push([label, 'Name', r.requesterName]);
      rows.push([label, 'E-Mail', r.requesterEmail]);
      rows.push([label, 'Status', r.status]);
      rows.push([label, 'Quelle', r.source ?? '']);
      rows.push([label, 'Betroffene Datensätze', r.affectedRecordsCount != null ? String(r.affectedRecordsCount) : '']);
      rows.push([label, 'Eingang', iso(r.createdAt)]);
      rows.push([label, 'Frist', iso(r.dueAt)]);
      rows.push([label, 'Erledigt am', iso(r.completedAt)]);
    }

    for (const p of processingActivities) {
      const label = `Verarbeitungen: ${p.purpose}`;
      rows.push([label, 'Rechtsgrundlage', p.legalBasis ?? '']);
      rows.push([label, 'Datenkategorien', p.dataCategories ?? '']);
      rows.push([label, 'Löschfrist', p.retentionPeriod ?? '']);
      rows.push([label, 'Empfänger', p.recipients ?? 'intern']);
    }

    for (const dp of dataProcessors) {
      const label = `Auftragsverarbeiter: ${dp.name}`;
      rows.push([label, 'Zweck', dp.purpose ?? '']);
      rows.push([label, 'Ort', dp.location ?? '']);
      rows.push([label, 'Drittlandtransfer', yn(dp.outsideEu)]);
      rows.push([label, 'AV-Vertrag vorhanden', yn(dp.hasContract)]);
      rows.push([label, 'Vertragsdatum', iso(dp.contractDate)]);
      rows.push([label, 'Hinweis', dp.complianceNote ?? '']);
    }

    for (const i of incidents) {
      const label = `Vorfälle: ${i.title}`;
      rows.push([label, 'Risiko', i.severity]);
      rows.push([label, 'Status', i.status]);
      rows.push([label, 'Bekannt geworden', iso(i.occurredAt)]);
      rows.push([label, 'Betroffene', i.affectedCount != null ? String(i.affectedCount) : '']);
      rows.push([label, 'Behörde gemeldet', iso(i.authorityNotifiedAt)]);
      rows.push([label, 'Betroffene informiert', iso(i.subjectsNotifiedAt)]);
      rows.push([label, 'Maßnahmen', i.measuresDocumented ?? '']);
    }

    // Datenschutz → Tab "Benutzer" (Nutzervorgabe, 2026-08-21: "benutzer
    // auch in den bericht mit aufnehmen") – gelöschte, noch nicht
    // anonymisierte Konten, gleiche Liste wie im Tab selbst.
    for (const u of deactivatedDue) {
      const label = `Benutzer: ${[u.firstName, u.lastName].filter(Boolean).join(' ')}`;
      rows.push([label, 'E-Mail', u.email]);
      rows.push([label, 'Gelöscht seit', iso(u.deletedAt)]);
      rows.push([label, 'Überfällig', yn(u.overdue)]);
    }

    rows.push(['Datenschutzbeauftragter', 'Extern', yn(settings.dpoIsExternal)]);
    rows.push(['Datenschutzbeauftragter', 'Name', settings.dpoName ?? '']);
    rows.push(['Datenschutzbeauftragter', 'Kanzlei/Abteilung', settings.dpoCompany ?? '']);
    rows.push(['Datenschutzbeauftragter', 'E-Mail', settings.dpoEmail ?? '']);
    rows.push(['Datenschutzbeauftragter', 'Telefon', settings.dpoPhone ?? '']);
    rows.push(['Datenschutzbeauftragter', 'Benannt seit', iso(settings.dpoAppointedAt)]);
    rows.push(['Datenschutzbeauftragter', 'Aufsichtsbehörde', settings.dpoSupervisoryAuthority ?? '']);

    rows.push(['Aufbewahrung', 'Zugriffsprotokoll fällig zur Löschung', String(accessLogDue.length)]);
    rows.push(['Aufbewahrung', 'Deaktivierte Konten fällig zur Löschung', String(deactivatedDue.length)]);
    rows.push(['Aufbewahrung', 'Papierkorb fällig zur Löschung', String(trashTotal)]);

    const header = 'Bereich,Feld,Wert';
    const lines = rows.map((r) => r.map(csvEscape).join(','));
    return CSV_BOM + [header, ...lines].join('\n');
  }

  /** "Auskunft erstellen" (Art. 15 DSGVO, Betroffenenrechte-Kachel auf der
   * Datenschutz-Seite, Nutzervorgabe 2026-08-19): sammelt alle im System
   * zu einer Person gespeicherten Daten, die über bestehende Services
   * bereits abfragbar sind (Konto, Aktivitätsprotokoll, verfasste Inhalte,
   * hochgeladene Medien) – kein separates Datenmodell nur für den Bericht. */
  async generateSubjectAccessReportCsv(userId: string): Promise<string> {
    const [user, activity, content, media] = await Promise.all([
      this.users.findOne(userId),
      this.auditLog.findForUser(userId, 1, 10000),
      this.prisma.content.findMany({
        where: { authorId: userId, deletedAt: null },
        select: { title: true, slug: true, status: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.media.findMany({
        where: { uploadedById: userId, deletedAt: null },
        select: { filename: true, size: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    const rows: string[][] = [
      ['Bereich', 'Feld', 'Wert'],
      ['Konto', 'E-Mail', user.email],
      ['Konto', 'Name', [user.firstName, user.lastName].filter(Boolean).join(' ')],
      ['Konto', 'Abteilung', user.department ?? ''],
      ['Konto', 'Telefon', user.phone ?? ''],
      ['Konto', 'Straße', user.street ?? ''],
      ['Konto', 'PLZ', user.postalCode ?? ''],
      ['Konto', 'Ort', user.city ?? ''],
      ['Konto', 'Rollen', user.roles.map((r) => r.name).join(', ')],
      ['Konto', 'Aktiv', user.isActive ? 'ja' : 'nein'],
      ['Konto', 'Angelegt am', user.createdAt.toISOString()],
      ['Konto', 'Letzte Anmeldung', user.lastLoginAt?.toISOString() ?? ''],
    ];

    for (const entry of activity.items) {
      rows.push([
        'Aktivitätsprotokoll',
        describeAuditAction(
          entry.action,
          entry.metadata as Record<string, unknown> | null,
        ),
        entry.createdAt.toISOString(),
      ]);
    }
    for (const item of content) {
      rows.push([
        'Verfasste Inhalte',
        `${item.title} (/${item.slug}, ${item.status})`,
        item.createdAt.toISOString(),
      ]);
    }
    for (const item of media) {
      rows.push([
        'Hochgeladene Medien',
        `${item.filename} (${item.size} Bytes)`,
        item.createdAt.toISOString(),
      ]);
    }

    return CSV_BOM + rows.map((r) => r.map(csvEscape).join(',')).join('\n');
  }

  /** "Auskunft senden" (Betroffenenrechte-Kachel, Nutzervorgabe
   * 2026-08-19): nutzt dieselbe Auskunft wie der Download-Button, aber
   * als Mail an die im Konto hinterlegte Adresse statt als Datei. */
  async sendSubjectAccessReport(userId: string): Promise<void> {
    const user = await this.users.findOne(userId);
    const csv = await this.generateSubjectAccessReportCsv(userId);
    await this.mailer.sendSubjectAccessReport(user.email, csv);
  }
}
