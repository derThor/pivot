import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';
import { MailerService } from '../mailer/mailer.service';
import { PrivacyService } from '../privacy/privacy.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { CreateDeletionRequestDto } from './dto/create-deletion-request.dto';
import { UpdateDeletionRequestDto } from './dto/update-deletion-request.dto';
import { CreateSelfServiceRequestDto } from './dto/create-self-service-request.dto';

const CSV_BOM = '﻿';

function csvEscape(v: string): string {
  return `"${v.replace(/"/g, '""')}"`;
}

const REQUEST_TYPE_LABELS: Record<string, string> = {
  deletion: 'Löschung',
  access: 'Auskunft',
  rectification: 'Berichtigung',
};

const ONE_MONTH_MS = 30 * 24 * 60 * 60 * 1000;

/** `DeletionRequest.source` für Anfragen aus dem Selbstauskunft-Footer
 * der öffentlichen Website. Als Konstante, weil der NotificationsService
 * genau darauf filtert – ein abweichender Freitext würde den Hinweis
 * lautlos verstummen lassen. */
export const PUBLIC_FORM_DSR_SOURCE = 'Selbstauskunft (Formular)';

@Injectable()
export class DeletionRequestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
    private readonly mailer: MailerService,
    private readonly privacyService: PrivacyService,
    private readonly auditLog: AuditLogService,
  ) {}

  findAll() {
    return this.prisma.deletionRequest.findMany({
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
    });
  }

  /** "Meine Daten" (Mein Konto → Sicherheit): eigene Anfragen des
   * aufrufenden Nutzers, damit er sieht, was er bereits gestellt hat und
   * per Klick die Details ansehen kann. Nur Anfragen mit gesetztem
   * `linkedUserId` – Admin-seitig angelegte Anfragen ohne Verknüpfung
   * (z.B. externe Anfragen per Post) tauchen hier bewusst nicht auf. */
  findMineForUser(userId: string) {
    return this.prisma.deletionRequest.findMany({
      where: { linkedUserId: userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  private async findOneRaw(id: string) {
    const row = await this.prisma.deletionRequest.findUnique({ where: { id } });
    if (!row) {
      throw new NotFoundException(`Anfrage ${id} nicht gefunden.`);
    }
    return row;
  }

  /** "DSR-2026-014" – pro Kalenderjahr fortlaufend. Als fertiger String
   * gespeichert statt bei jedem Lesen neu berechnet, damit die Nummer nach
   * dem Anlegen stabil bleibt (auch wenn ältere Einträge später gelöscht
   * werden). */
  private async generateDsrId(): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `DSR-${year}-`;
    const last = await this.prisma.deletionRequest.findFirst({
      where: { dsrId: { startsWith: prefix } },
      orderBy: { dsrId: 'desc' },
    });
    const lastNumber = last ? parseInt(last.dsrId.slice(prefix.length), 10) : 0;
    return `${prefix}${String(lastNumber + 1).padStart(3, '0')}`;
  }

  async create(dto: CreateDeletionRequestDto) {
    const dsrId = await this.generateDsrId();
    const row = await this.prisma.deletionRequest.create({
      data: {
        ...dto,
        dsrId,
        // DSGVO Art. 12(3): Antwortfrist von einem Monat, sofern keine
        // eigene Frist angegeben wurde.
        dueAt: dto.dueAt
          ? new Date(dto.dueAt)
          : new Date(Date.now() + ONE_MONTH_MS),
      },
    });
    await this.sendAcknowledgementIfEnabled(row);
    return row;
  }

  /** Selbstauskunft/-löschung aus dem eigenen Konto heraus (Nutzervorgabe,
   * 2026-08-19) – im Unterschied zu `create()` (Admin-Dialog) kommen
   * Name/E-Mail/Verknüpfung nicht aus Nutzereingaben, sondern direkt aus
   * dem eigenen, per JWT authentifizierten Konto. Braucht keine
   * `privacy:create`-Berechtigung, nur einen gültigen Login (Controller
   * verzichtet bewusst auf `@RequirePermission`) – jeder Nutzer darf eine
   * Anfrage zu sich selbst stellen. Frontend-Einstiegspunkt (Mein Konto)
   * folgt in einer späteren Session, siehe
   * knowledge-base/auth/data-subject-requests.md. */
  async createSelfService(userId: string, dto: CreateSelfServiceRequestDto) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });
    const dsrId = await this.generateDsrId();
    const row = await this.prisma.deletionRequest.create({
      data: {
        dsrId,
        type: dto.type ?? 'access',
        requesterName: [user.firstName, user.lastName]
          .filter(Boolean)
          .join(' '),
        requesterEmail: user.email,
        reason: dto.reason,
        source: 'Selbstauskunft (Mein Konto)',
        linkedUserId: user.id,
        dueAt: new Date(Date.now() + ONE_MONTH_MS),
      },
    });
    await this.sendAcknowledgementIfEnabled(row);
    return row;
  }

  /** Auskunftsanfrage aus dem Formular-Footer der öffentlichen Website
   * (Nutzervorgabe, 2026-09-02) – von einem ANONYMEN Besucher, der kein
   * Konto hat und deshalb `createSelfService()` nicht nutzen kann.
   *
   * Legt ausschließlich die Anfrage an. Es werden **keine Daten
   * herausgegeben** und auch nicht verraten, ob es zu der Adresse
   * überhaupt etwas gibt – sonst wäre das ein Auskunftskanal ohne
   * Identitätsprüfung, über den jeder abfragen könnte, wer hier Kunde
   * ist. Die Identität prüft der Betreiber beim Bearbeiten, wie bei jeder
   * anderen Anfrage auch.
   *
   * Bewusst KEIN `linkedUserId`: die Verknüpfung mit einem Konto entsteht
   * erst über den geprüften E-Mail-Abgleich beim "Datenauszug erstellen"
   * im Backend. */
  async createFromPublicForm(email: string, note?: string) {
    const dsrId = await this.generateDsrId();
    const row = await this.prisma.deletionRequest.create({
      data: {
        dsrId,
        type: 'access',
        requesterName: email,
        requesterEmail: email,
        reason: note,
        source: PUBLIC_FORM_DSR_SOURCE,
        dueAt: new Date(Date.now() + ONE_MONTH_MS),
      },
    });
    await this.sendAcknowledgementIfEnabled(row);
    return { ok: true as const, dsrId: row.dsrId };
  }

  private async sendAcknowledgementIfEnabled(row: {
    requesterEmail: string;
    dsrId: string;
  }) {
    const settings = await this.settings.get();
    if (settings.dsrAutoAcknowledgeReceipt) {
      await this.mailer.sendDeletionRequestAcknowledgement(
        row.requesterEmail,
        row.dsrId,
      );
    }
  }

  async update(id: string, dto: UpdateDeletionRequestDto) {
    await this.findOneRaw(id);
    // Setzt completedAt automatisch, wenn der Status auf "erledigt"/
    // "abgelehnt" wechselt und noch kein Zeitpunkt gesetzt ist – kein
    // manuelles Datumsfeld für einen ohnehin ableitbaren Wert.
    const completedAt =
      dto.status === 'completed' || dto.status === 'rejected'
        ? new Date()
        : undefined;
    return this.prisma.deletionRequest.update({
      where: { id },
      data: {
        ...dto,
        dueAt: dto.dueAt ? new Date(dto.dueAt) : undefined,
        ...(completedAt && { completedAt }),
      },
    });
  }

  async remove(id: string) {
    await this.findOneRaw(id);
    await this.prisma.deletionRequest.delete({ where: { id } });
  }

  /** "Anfrage zurückziehen" (Mein Konto → Sicherheit → "Meine Daten",
   * Nutzervorgabe 2026-08-19) – nur der verknüpfte Nutzer darf seine
   * eigene Anfrage entfernen, kein `privacy:delete` nötig. Wirft
   * `ForbiddenException`, wenn die Anfrage einem anderen Konto gehört
   * oder (noch) keinem Konto verknüpft ist. */
  async withdrawSelfService(id: string, userId: string) {
    const row = await this.findOneRaw(id);
    if (row.linkedUserId !== userId) {
      throw new ForbiddenException(
        'Diese Anfrage gehört nicht zu deinem Konto.',
      );
    }
    await this.prisma.deletionRequest.delete({ where: { id } });
  }

  /** "Daten endgültig löschen" (Detail-Panel): es gibt keine Live-
   * Verknüpfung zu konkreten Datensätzen, die sich automatisch löschen
   * ließen (freier Text als Quelle, manuell erfasste Anzahl Datensätze) –
   * daher eine reine Attestierung: der Admin bestätigt, dass die Löschung
   * außerhalb des Systems erledigt wurde. Nutzervorgabe, 2026-08-19. */
  async markCompleted(id: string, actingUserId: string) {
    const row = await this.findOneRaw(id);
    const updated = await this.prisma.deletionRequest.update({
      where: { id },
      data: { status: 'completed', completedAt: new Date() },
    });
    await this.auditLog.record({
      action: 'deletion_request.completed',
      entityType: 'DeletionRequest',
      entityId: row.id,
      userId: actingUserId,
      metadata: { dsrId: row.dsrId, requesterEmail: row.requesterEmail },
    });
    return updated;
  }

  /** "Rückfrage an Absender" – der Admin schreibt die Rückfrage im Popup
   * selbst (Nutzervorgabe, 2026-08-19). */
  async sendFollowUp(id: string, message: string) {
    const row = await this.findOneRaw(id);
    await this.mailer.sendDeletionRequestFollowUp(
      row.requesterEmail,
      row.dsrId,
      message,
    );
  }

  /** "Datenauszug erstellen" (Nutzervorgabe, 2026-08-19: "Wenn ein echtes
   * Konto vorhanden ist, dann verknüpfen, ansonsten nur die Anfrage"):
   * sucht per E-Mail-Abgleich ein bestehendes, nicht anonymisiertes Konto.
   * Bei Treffer wird die Anfrage dauerhaft verknüpft und der echte
   * Art.-15-Bericht erzeugt (derselbe Generator wie bei "Auskunft
   * erstellen"). Ohne Treffer nur ein Nachweis-Protokoll der Anfrage
   * selbst – kein Zugriff auf Live-Systemdaten, da es dafür keine feste
   * Verknüpfung gibt (kein Formular-Modul). */
  async generateDataExtract(id: string): Promise<string> {
    const row = await this.findOneRaw(id);

    let linkedUserId = row.linkedUserId;
    if (!linkedUserId) {
      const match = await this.prisma.user.findFirst({
        where: { email: row.requesterEmail, anonymizedAt: null },
      });
      if (match) {
        linkedUserId = match.id;
        await this.prisma.deletionRequest.update({
          where: { id },
          data: { linkedUserId },
        });
      }
    }

    if (linkedUserId) {
      return this.privacyService.generateSubjectAccessReportCsv(linkedUserId);
    }
    return this.generateProtocolCsv(row);
  }

  private generateProtocolCsv(row: {
    dsrId: string;
    type: string;
    requesterName: string;
    requesterEmail: string;
    reason: string | null;
    source: string | null;
    affectedRecordsCount: number | null;
    status: string;
    createdAt: Date;
    dueAt: Date | null;
    completedAt: Date | null;
  }): string {
    const rows: string[][] = [
      ['Feld', 'Wert'],
      ['DSR-ID', row.dsrId],
      ['Art', REQUEST_TYPE_LABELS[row.type] ?? row.type],
      ['Name', row.requesterName],
      ['E-Mail', row.requesterEmail],
      ['Grund', row.reason ?? ''],
      ['Quelle', row.source ?? ''],
      [
        'Betroffene Datensätze',
        row.affectedRecordsCount != null
          ? String(row.affectedRecordsCount)
          : '',
      ],
      ['Status', row.status],
      ['Eingang', row.createdAt.toISOString()],
      ['Frist', row.dueAt?.toISOString() ?? ''],
      ['Erledigt am', row.completedAt?.toISOString() ?? ''],
    ];
    return CSV_BOM + rows.map((r) => r.map(csvEscape).join(',')).join('\n');
  }
}
