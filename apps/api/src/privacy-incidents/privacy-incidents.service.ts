import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';
import { MailerService } from '../mailer/mailer.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { CreatePrivacyIncidentDto } from './dto/create-privacy-incident.dto';
import { UpdatePrivacyIncidentDto } from './dto/update-privacy-incident.dto';

const CSV_BOM = '﻿';

function csvEscape(v: string): string {
  return `"${v.replace(/"/g, '""')}"`;
}

const SEVERITY_LABELS: Record<string, string> = {
  low: 'Niedrig',
  medium: 'Mittel',
  high: 'Hoch',
};

@Injectable()
export class PrivacyIncidentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
    private readonly mailer: MailerService,
    private readonly auditLog: AuditLogService,
  ) {}

  findAll() {
    return this.prisma.privacyIncident.findMany({
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
    });
  }

  private async findOneRaw(id: string) {
    const row = await this.prisma.privacyIncident.findUnique({ where: { id } });
    if (!row) {
      throw new NotFoundException(`Vorfall ${id} nicht gefunden.`);
    }
    return row;
  }

  async create(dto: CreatePrivacyIncidentDto) {
    const created = await this.prisma.privacyIncident.create({
      data: {
        ...dto,
        occurredAt: dto.occurredAt ? new Date(dto.occurredAt) : undefined,
      },
    });

    const settings = await this.settings.get();
    if (settings.dpoNotifyOnIncident && settings.dpoEmail) {
      await this.mailer.sendDpoIncidentNotification(settings.dpoEmail, created);
    }

    return created;
  }

  async update(id: string, dto: UpdatePrivacyIncidentDto) {
    await this.findOneRaw(id);
    const resolvedAt = dto.status === 'resolved' ? new Date() : undefined;
    return this.prisma.privacyIncident.update({
      where: { id },
      data: {
        ...dto,
        occurredAt: dto.occurredAt ? new Date(dto.occurredAt) : undefined,
        ...(resolvedAt && { resolvedAt }),
      },
    });
  }

  async remove(id: string) {
    await this.findOneRaw(id);
    await this.prisma.privacyIncident.delete({ where: { id } });
  }

  /** "Behörde melden" (Ablauf-Schritt 3, Art. 33 DSGVO) – reine
   * Attestierung wie bei den Betroffenenanfragen ("Wurde die Meldung an
   * die Aufsichtsbehörde übermittelt?"), kein echter Versand an eine
   * Behörden-Schnittstelle. */
  async reportToAuthority(id: string, actingUserId: string) {
    const row = await this.findOneRaw(id);
    const updated = await this.prisma.privacyIncident.update({
      where: { id },
      data: { authorityNotifiedAt: new Date() },
    });
    await this.auditLog.record({
      action: 'privacy_incident.reported',
      entityType: 'PrivacyIncident',
      entityId: row.id,
      userId: actingUserId,
      metadata: { title: row.title },
    });
    return updated;
  }

  /** "Betroffene informieren" (Ablauf-Schritt 4, Art. 34 DSGVO) – ebenfalls
   * reine Attestierung: es gibt keine feste Liste betroffener Personen
   * (`affectedCount` ist eine manuelle Zahl), also kein echter Massen-
   * versand, gleiches Prinzip wie bei den Betroffenenanfragen. */
  async notifySubjects(id: string, actingUserId: string) {
    const row = await this.findOneRaw(id);
    const updated = await this.prisma.privacyIncident.update({
      where: { id },
      data: { subjectsNotifiedAt: new Date() },
    });
    await this.auditLog.record({
      action: 'privacy_incident.subjects_notified',
      entityType: 'PrivacyIncident',
      entityId: row.id,
      userId: actingUserId,
      metadata: { title: row.title },
    });
    return updated;
  }

  /** "Meldung ansehen" – erzeugt aus den gespeicherten Feldern denselben
   * Protokoll-CSV-Stil wie der Betroffenenanfragen-Datenauszug
   * (`DeletionRequestsService.generateProofCsv`), kein separat
   * gespeicherter Meldetext. */
  async generateReportCsv(id: string): Promise<string> {
    const row = await this.findOneRaw(id);
    const rows: string[][] = [
      ['Feld', 'Wert'],
      ['Titel', row.title],
      ['Beschreibung', row.description ?? ''],
      ['Risiko', SEVERITY_LABELS[row.severity] ?? row.severity],
      [
        'Betroffene',
        row.affectedCount != null ? String(row.affectedCount) : '',
      ],
      ['Bekannt geworden', row.occurredAt?.toISOString() ?? ''],
      [
        'An Aufsichtsbehörde gemeldet am',
        row.authorityNotifiedAt?.toISOString() ?? '',
      ],
    ];
    return CSV_BOM + rows.map((r) => r.map(csvEscape).join(',')).join('\n');
  }
}
