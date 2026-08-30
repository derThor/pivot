import { Injectable } from '@nestjs/common';
import { Prisma } from '@pivot/database';
import { PrismaService } from '../prisma/prisma.service';

export interface RecordAuditLogParams {
  action: string;
  entityType: string;
  entityId: string;
  userId: string;
  metadata?: Prisma.InputJsonValue;
}

// Zentraler Schreib-/Lesezugriff auf `AuditLog` (bisher nur für
// `user.impersonate` genutzt, siehe AuthService.impersonate()) – als
// `@Global()`-Service statt Ad-hoc-`prisma.auditLog.create()`-Aufrufen in
// jedem Modul, gleiches Muster wie CacheService. Grundlage für den
// "Aktivität"-Tab auf der Benutzer-Profilseite (2b.14-Nachtrag,
// 2026-08-17): jede hier erfasste Aktion erscheint dort in einer echten,
// serverseitig paginierten Zeitleiste.
@Injectable()
export class AuditLogService {
  constructor(private readonly prisma: PrismaService) {}

  record(params: RecordAuditLogParams) {
    return this.prisma.auditLog.create({ data: params });
  }

  /**
   * Aktivitäten eines Benutzers: Dinge, die er selbst getan hat (`userId`
   * = er selbst, z.B. Medien hochgeladen, eigenes Passwort geändert) UND
   * Dinge, die ein anderer an seinem Konto verändert hat (`entityType`
   * "User" + `entityId` = er selbst, z.B. Rollenänderung durch einen
   * Administrator). Echte DB-seitige Pagination (`skip`/`take`) statt
   * alles zu laden und im Speicher zu blättern – bei `@@index([userId,
   * createdAt])` bzw. dem bestehenden `@@index([entityType, entityId])`
   * bleibt das auch bei vielen Einträgen schnell.
   */
  async findForUser(userId: string, page: number, pageSize: number) {
    const where: Prisma.AuditLogWhereInput = {
      OR: [{ userId }, { entityType: 'User', entityId: userId }],
    };
    const [items, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          user: { select: { id: true, firstName: true, lastName: true } },
        },
      }),
      this.prisma.auditLog.count({ where }),
    ]);
    return {
      items,
      meta: { page, pageSize, total, pageCount: Math.ceil(total / pageSize) },
    };
  }

  /** Unpaginiert, gleiche OR-Bedingung wie `findForUser()` – für den
   * CSV-Export des "Aktivität"-Tabs (UsersService.exportActivityCsv()),
   * bewusst kein Limit, ein Export soll die komplette Historie enthalten
   * (gleiches Prinzip wie `findAllForEntity()`). */
  async findAllForUser(userId: string) {
    return this.prisma.auditLog.findMany({
      where: { OR: [{ userId }, { entityType: 'User', entityId: userId }] },
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { id: true, firstName: true, lastName: true } },
      },
    });
  }

  /** Neueste N Einträge zu einer bestimmten Entität, unabhängig vom
   * Akteur – z.B. "Letzte Änderungen" der Firma-Stammdaten
   * (SettingsService.update()). */
  async findRecentForEntity(
    entityType: string,
    entityId: string,
    limit: number,
  ) {
    return this.prisma.auditLog.findMany({
      where: { entityType, entityId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        user: { select: { id: true, firstName: true, lastName: true } },
      },
    });
  }

  /** Echte paginierte Liste zu einer Entität (im Gegensatz zu
   * `findRecentForEntity`s festem Limit) – "Protokoll"-Tab unter
   * Einstellungen (SettingsService.getSettingsChanges()). */
  async findPaginated(
    entityTypes: string[],
    entityId: string,
    page: number,
    pageSize: number,
  ) {
    const where: Prisma.AuditLogWhereInput = {
      entityType: { in: entityTypes },
      entityId,
    };
    const [items, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          user: { select: { id: true, firstName: true, lastName: true } },
        },
      }),
      this.prisma.auditLog.count({ where }),
    ]);
    return {
      items,
      meta: { page, pageSize, total, pageCount: Math.ceil(total / pageSize) },
    };
  }

  /** Unpaginiert, für den CSV-Export (SettingsService.exportChangesCsv()) –
   * bewusst kein Limit, ein Export soll die komplette Historie enthalten. */
  async findAllForEntity(entityTypes: string[], entityId: string) {
    return this.prisma.auditLog.findMany({
      where: { entityType: { in: entityTypes }, entityId },
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { id: true, firstName: true, lastName: true } },
      },
    });
  }

  /** Einzelnen Eintrag löschen (Nutzervorgabe, 2026-08-22: "das soll man
   * löschen können" – anders als bei Firma bewusst NICHT revisionssicher). */
  async deleteOne(id: string) {
    await this.prisma.auditLog.delete({ where: { id } });
  }

  /** "Alle löschen" für eine Entität (Nutzervorgabe, 2026-08-22: "mache
   * bei letzte änderung ... rechts alle löschen dazu"). */
  async deleteAllForEntity(entityTypes: string[], entityId: string) {
    await this.prisma.auditLog.deleteMany({
      where: { entityType: { in: entityTypes }, entityId },
    });
  }

  /** Datenschutz-Aufbewahrung "Zugriffsprotokoll": Einträge älter als
   * `cutoff` – für die manuelle Review-Liste, kein automatisches Löschen. */
  async findOlderThan(cutoff: Date) {
    return this.prisma.auditLog.findMany({
      where: { createdAt: { lt: cutoff } },
      orderBy: { createdAt: 'asc' },
      select: { id: true, action: true, createdAt: true },
    });
  }

  async deleteMany(ids: string[]) {
    await this.prisma.auditLog.deleteMany({ where: { id: { in: ids } } });
  }
}
