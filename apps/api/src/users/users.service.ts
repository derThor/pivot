import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as argon2 from 'argon2';
import { randomBytes } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';
import { CacheService } from '../cache/cache.service';
import { MediaService } from '../media/media.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { describeAuditAction } from '../audit-log/describe-audit-action';
import { LicenseClientService } from '../license-client/license-client.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { QueryUserDto } from './dto/query-user.dto';
import type { JwtPayload } from '../auth/strategies/jwt.strategy';

function csvEscape(v: unknown): string {
  return `"${String(v).replace(/"/g, '""')}"`;
}

// Ohne BOM interpretieren Excel/Windows-Editoren die UTF-8-Datei als
// Windows-1252 und zeigen Umlaute als Mojibake – gleiches Muster wie
// SettingsService.CSV_BOM (dort ausführlicher kommentiert), hier separat
// dupliziert statt geteilt.
const CSV_BOM = '﻿';

const publicSelect = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  avatarUrl: true,
  department: true,
  phone: true,
  street: true,
  postalCode: true,
  city: true,
  isActive: true,
  emailVerifiedAt: true,
  lastLoginAt: true,
  mustChangePassword: true,
  twoFactorEnabled: true,
  twoFactorEnabledAt: true,
  failedLoginAttempts: true,
  deletedAt: true,
  anonymizedAt: true,
  createdAt: true,
  updatedAt: true,
  userRoles: {
    select: { role: { select: { id: true, name: true } } },
    orderBy: { role: { sortOrder: 'asc' as const } },
  },
} as const;

// API-Form flacht die Join-Tabelle zu `roles: {id,name}[]` ab, statt die
// interne `userRoles`-Zwischentabelle nach außen zu geben.
function toPublicUser<
  T extends { userRoles: { role: { id: string; name: string } }[] },
>(user: T) {
  const { userRoles, ...rest } = user;
  return { ...rest, roles: userRoles.map((ur) => ur.role) };
}

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
    private readonly cache: CacheService,
    private readonly media: MediaService,
    private readonly auditLog: AuditLogService,
    private readonly licenseClient: LicenseClientService,
  ) {}

  // Bugreport, 2026-08-29: "wenn man bei einer App, wo Datenschutz nicht
  // aktiviert ist, einen Nutzer löscht, kommt im Popup: wird unter
  // Datenschutz -> Benutzer abgelegt und muss dort anonymisiert werden.
  // das geht nicht" – `/dashboard/privacy` blockt komplett (siehe
  // privacy/page.tsx), sobald KEIN einziger Reiter freigeschaltet ist
  // (Modul komplett aus ODER alle Features einzeln deaktiviert – gleiche
  // Bedingung wie dort, bewusst NICHT nur `modules.includes('datenschutz')`,
  // das würde den zweiten Fall übersehen). Der Reiter "Nutzer" ist dann
  // nie erreichbar, ein gelöschter, aber nie anonymisierter Nutzer bliebe
  // für immer in der Warteschlange hängen. Gleiche Quelle wie
  // `ModuleEntitlementGuard`/`NotificationsService.hasModuleFeature`
  // (Master wie Slave einheitlich).
  private async isDatenschutzModuleActive(): Promise<boolean> {
    const effective = await this.licenseClient.getEffectiveStatus();
    const moduleFeatures =
      'moduleFeatures' in effective ? effective.moduleFeatures : {};
    return (moduleFeatures.datenschutz ?? []).length > 0;
  }

  async findAll(query: QueryUserDto) {
    const { page, pageSize, roleId, isActive, anonymized, deleted, q } = query;
    // Gelöschte (siehe delete()) und anonymisierte Konten sind standardmäßig
    // ausgeblendet – über `deleted`/`anonymized` gezielt abrufbar (Tabs
    // "Gelöscht"/"Anonymisiert", Nutzervorgabe 2026-08-21). Bewusst sich
    // gegenseitig ausschließende Zweige statt zweier unabhängiger
    // `deletedAt`/`anonymizedAt`-Filter: ein anonymisierter Nutzer hat immer
    // auch `deletedAt` gesetzt (anonymize() räumt es nicht ab), ein simples
    // `deletedAt: deleted ? {not:null} : null` kombiniert mit
    // `anonymizedAt: {not:null}` hätte die Anonymisiert-Liste sonst immer
    // leer gelassen (Nutzer-Bugreport, 2026-08-21). Gesperrte
    // (isActive:false) bleiben bewusst immer in der Standardliste sichtbar.
    const stateFilter = anonymized
      ? { anonymizedAt: { not: null } }
      : deleted
        ? { deletedAt: { not: null }, anonymizedAt: null }
        : { deletedAt: null, anonymizedAt: null };
    const where = {
      ...stateFilter,
      ...(roleId && { userRoles: { some: { roleId } } }),
      ...(isActive !== undefined && { isActive }),
      ...(q && {
        OR: [
          { firstName: { contains: q, mode: 'insensitive' as const } },
          { lastName: { contains: q, mode: 'insensitive' as const } },
          { email: { contains: q, mode: 'insensitive' as const } },
        ],
      }),
    };
    const [items, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        select: publicSelect,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.user.count({ where }),
    ]);
    return {
      items: items.map(toPublicUser),
      meta: { page, pageSize, total, pageCount: Math.ceil(total / pageSize) },
    };
  }

  /** Ermittelt, auf welcher Seite (bei gegebener pageSize) ein Eintrag liegt. */
  async findPage(id: string, pageSize: number) {
    const target = await this.prisma.user.findUniqueOrThrow({ where: { id } });
    const rank = await this.prisma.user.count({
      where: { createdAt: { gt: target.createdAt } },
    });
    return { page: Math.floor(rank / pageSize) + 1 };
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: publicSelect,
    });
    if (!user) {
      throw new NotFoundException(`Benutzer ${id} nicht gefunden.`);
    }
    return toPublicUser(user);
  }

  // Nur Administratoren (und Pivot) dürfen die Administrator-Rolle
  // vergeben (Nutzervorgabe, 2026-08-16) – `users:update`/`users:invite`
  // allein hätten sonst z.B. Manager erlaubt, sich oder andere zum Admin
  // zu machen (`roles:read` reicht, um die Rollen-ID zu ermitteln). Die
  // Pivot-Rolle selbst ist noch enger geschützt: nur wer bereits Pivot
  // ist, darf sie vergeben (Nutzervorgabe, 2026-08-21: "die kann alles" –
  // sonst könnte ein Administrator sich über die Rollenvergabe selbst zu
  // Pivot befördern, obwohl Einstellungen bewusst "nur pivot" vorbehalten
  // sein sollen). Namensbasiert wie `isAdministrator`-Checks im Frontend.
  private async assertMayAssignRole(
    actingUser: JwtPayload,
    roleIds: string[] | undefined,
  ) {
    if (!roleIds?.length) return;
    const isPivot = actingUser.roleNames.includes('Pivot');
    const roles = await this.prisma.role.findMany({
      where: { id: { in: roleIds } },
      select: { name: true },
    });
    if (roles.some((role) => role.name === 'Pivot') && !isPivot) {
      throw new ForbiddenException('Nur Pivot kann die Pivot-Rolle vergeben.');
    }
    if (
      roles.some((role) => role.name === 'Administrator') &&
      !isPivot &&
      !actingUser.roleNames.includes('Administrator')
    ) {
      throw new ForbiddenException(
        'Nur Administratoren können die Administrator-Rolle vergeben.',
      );
    }
  }

  async create(dto: CreateUserDto, actingUser: JwtPayload) {
    await this.assertMayAssignRole(actingUser, dto.roleIds);
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existing) {
      throw new ConflictException('E-Mail-Adresse wird bereits verwendet.');
    }

    const roleIds = dto.roleIds?.length
      ? dto.roleIds
      : [
          (
            await this.prisma.role.findFirstOrThrow({
              where: { isDefault: true },
            })
          ).id,
        ];
    // Kein admin-vergebenes Passwort mehr (Nutzervorgabe, 2026-08-17): der
    // Hash ist zufällig und wird nie offengelegt, genau wie bei
    // anonymize() unten. Der Zugang läuft über den bestehenden
    // Passwort-Reset-Link, den der Controller nach dem Anlegen verschickt
    // (siehe UsersController.create()).
    const passwordHash = await argon2.hash(randomBytes(32).toString('hex'));

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        firstName: dto.firstName,
        lastName: dto.lastName,
        userRoles: { create: roleIds.map((roleId) => ({ roleId })) },
        passwordHash,
      },
      select: publicSelect,
    });
    await this.auditLog.record({
      action: 'user.created',
      entityType: 'User',
      entityId: user.id,
      userId: actingUser.sub,
      metadata: { method: 'admin_created' },
    });
    return toPublicUser(user);
  }

  async update(id: string, dto: UpdateUserDto, actingUser: JwtPayload) {
    await this.assertMayAssignRole(actingUser, dto.roleIds);
    const existing = await this.findOneRaw(id);
    if (existing.anonymizedAt) {
      throw new BadRequestException(
        'Dieser Nutzer wurde anonymisiert und kann nicht mehr bearbeitet werden.',
      );
    }

    if (dto.email && dto.email !== existing.email) {
      await this.assertEmailChangeAllowed(dto.email, actingUser);
    }
    let newRoleNames: string[] | undefined;
    if (dto.roleIds) {
      if (dto.roleIds.length === 0) {
        throw new BadRequestException(
          'Ein Benutzer benötigt mindestens eine Rolle.',
        );
      }
      const roles = await this.prisma.role.findMany({
        where: { id: { in: dto.roleIds } },
      });
      if (roles.length !== dto.roleIds.length) {
        throw new BadRequestException('Rolle nicht gefunden.');
      }
      // Nur wirklich geänderte Zuweisungen loggen, nicht jedes Speichern
      // des Formulars mit unveränderten Rollen (Vergleich über Set, da die
      // Reihenfolge der IDs keine Bedeutung hat).
      const currentUserRoles = await this.prisma.userRole.findMany({
        where: { userId: id },
        select: { roleId: true },
      });
      const currentRoleIds = new Set(currentUserRoles.map((ur) => ur.roleId));
      const roleIdsChanged =
        dto.roleIds.length !== currentRoleIds.size ||
        dto.roleIds.some((roleId) => !currentRoleIds.has(roleId));
      if (roleIdsChanged) {
        newRoleNames = roles.map((role) => role.name);
      }
    }

    const { roleIds, ...rest } = dto;
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id },
        // `pendingActivation` verschwindet automatisch, sobald ein Admin
        // den Nutzer aktiviert (siehe Schema-Kommentar zu `User.pendingActivation`).
        // `deactivatedAt` folgt demselben Muster für die Datenschutz-
        // Aufbewahrungsfrist "Deaktivierte Konten".
        data: rest.isActive
          ? { ...rest, pendingActivation: false, deactivatedAt: null }
          : rest.isActive === false
            ? { ...rest, deactivatedAt: new Date() }
            : rest,
      }),
      ...(roleIds
        ? [
            this.prisma.userRole.deleteMany({ where: { userId: id } }),
            this.prisma.userRole.createMany({
              data: roleIds.map((roleId) => ({ userId: id, roleId })),
            }),
          ]
        : []),
    ]);
    if (newRoleNames) {
      await this.auditLog.record({
        action: 'user.role_changed',
        entityType: 'User',
        entityId: id,
        userId: actingUser.sub,
        metadata: { roleNames: newRoleNames },
      });
    }
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id },
      select: publicSelect,
    });
    return toPublicUser(user);
  }

  async updateProfile(
    id: string,
    dto: UpdateProfileDto,
    actingUser: JwtPayload,
  ) {
    const existing = await this.findOneRaw(id);

    if (dto.email && dto.email !== existing.email) {
      await this.assertEmailChangeAllowed(dto.email, actingUser);
    }

    const user = await this.prisma.user.update({
      where: { id },
      data: dto,
      select: publicSelect,
    });
    return toPublicUser(user);
  }

  // Admin-Notausgang bei Handy-/Gerätverlust ohne (mehr) gültigen
  // Recovery-Code (Nutzervorgabe, 2026-08-17) – bewusst ohne
  // Passwort-Bestätigung wie bei der Self-Service-Deaktivierung
  // (AuthService.disableTwoFactor()): der Admin bestätigt sich bereits über
  // sein eigenes `users:update`-Recht, nicht über das Passwort des
  // betroffenen Nutzers. Kein eigenes Recht wie `users:deactivate` – reine
  // Feld-Änderung am Nutzer, gleiche Einordnung wie das erzwungene
  // `mustChangePassword` in UpdateUserDto.
  async disableTwoFactor(id: string, actingUserId: string) {
    await this.findOneRaw(id);
    const user = await this.prisma.user.update({
      where: { id },
      data: {
        twoFactorEnabled: false,
        twoFactorEnabledAt: null,
        twoFactorSecret: null,
        twoFactorRecoveryCodes: [],
      },
      select: publicSelect,
    });
    await this.auditLog.record({
      action: 'user.2fa_disabled',
      entityType: 'User',
      entityId: id,
      userId: actingUserId,
    });
    return toPublicUser(user);
  }

  // Soft-Delete statt `prisma.user.delete()`: ein Hard-Delete brach mit
  // einem FK-Constraint-Fehler (`contents_authorId_fkey`), sobald der
  // Nutzer irgendeinen Content verfasst hatte – praktisch jeder Editor
  // nach der ersten Seite. Passt außerdem besser zum Rechtenamen
  // `users:deactivate` (siehe knowledge-base/auth/rbac-rework.md): der
  // Zugriff wird entzogen, die Autorenschaft bestehender Inhalte bleibt
  // aber nachvollziehbar erhalten. Bestehende Refresh-Tokens werden
  // widerrufen, damit der Zugriffsentzug sofort greift statt erst nach
  // Ablauf des Access-Tokens (siehe AuthService.refresh()).
  async remove(id: string, currentUserId: string) {
    if (id === currentUserId) {
      throw new BadRequestException(
        'Du kannst dein eigenes Konto nicht löschen.',
      );
    }
    await this.findOne(id);
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id },
        data: { isActive: false, deactivatedAt: new Date() },
      }),
      this.prisma.refreshToken.updateMany({
        where: { userId: id, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);
  }

  // "Nutzer löschen" (Bearbeiten-Seite, Nutzervorgabe 2026-08-21): eigener,
  // dritter Zustand neben Sperren (`remove()`) und Anonymisieren
  // (`anonymize()`) – noch reversibel (kein Datenverlust), verschwindet
  // aber aus der normalen Benutzerliste (siehe `findAll()`) und taucht
  // stattdessen unter Datenschutz → "Nutzer" auf. Erst von dort aus wird
  // endgültig anonymisiert. Ist das Datenschutz-Modul auf dieser
  // Installation gar nicht aktiv, gibt es diesen Reiter nirgends erreichbar
  // – dann sofort anonymisieren statt in der Warteschlange hängen zu
  // bleiben (Bugreport, 2026-08-29, siehe `isDatenschutzModuleActive`).
  async delete(id: string, currentUserId: string) {
    if (id === currentUserId) {
      throw new BadRequestException(
        'Du kannst dein eigenes Konto nicht löschen.',
      );
    }
    await this.findOne(id);
    if (!(await this.isDatenschutzModuleActive())) {
      await this.anonymize(id, currentUserId);
      return;
    }
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id },
        data: { isActive: false, deletedAt: new Date() },
      }),
      this.prisma.refreshToken.updateMany({
        where: { userId: id, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);
  }

  // "Wiederherstellen" (Nutzervorgabe, 2026-08-21: "auf gelöscht gesetzte
  // nutzer sollen wiederhergestellt werden können, solange sie nicht
  // anonymisiert wurden") – macht `delete()` rückgängig, sowohl unter
  // Datenschutz → "Benutzer" als auch auf der Benutzer-Seite (Tab
  // "Gelöscht") auslösbar. Nach der Anonymisierung nicht mehr möglich,
  // da keine personenbezogenen Daten mehr übrig sind, die wiederherzustellen
  // wären.
  async restore(id: string) {
    const existing = await this.findOneRaw(id);
    if (!existing.deletedAt) {
      throw new BadRequestException('Dieser Nutzer ist nicht gelöscht.');
    }
    if (existing.anonymizedAt) {
      throw new BadRequestException(
        'Anonymisierte Nutzer können nicht wiederhergestellt werden.',
      );
    }
    const user = await this.prisma.user.update({
      where: { id },
      data: { deletedAt: null, isActive: true },
      select: publicSelect,
    });
    return toPublicUser(user);
  }

  // "Endgültig löschen" (Datenschutz → Tab "Nutzer", Nutzervorgabe
  // 2026-08-21: nur von dort aus auslösbar, nicht mehr direkt von der
  // Benutzer-Bearbeiten-Seite). Anders als `delete()`/`remove()` NICHT
  // reversibel – entfernt alle personenbezogenen Daten, behält aber
  // Zeile/`id`, damit `contents_authorId_fkey` & Co. gültig bleiben (siehe
  // knowledge-base/auth/rbac-rework.md). `email` bekommt einen eindeutigen
  // Platzhalter (Unique-Constraint), `passwordHash` einen zufälligen,
  // nicht einlösbaren Wert (Login danach unmöglich).
  async anonymize(id: string, currentUserId: string) {
    if (id === currentUserId) {
      throw new BadRequestException(
        'Du kannst dein eigenes Konto nicht löschen.',
      );
    }
    const existing = await this.findOneRaw(id);
    if (existing.anonymizedAt) {
      return;
    }
    const passwordHash = await argon2.hash(randomBytes(32).toString('hex'));
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id },
        data: {
          email: `deleted-${id}@anonymized.local`,
          firstName: null,
          lastName: 'Gelöschter Nutzer',
          avatarUrl: null,
          department: null,
          phone: null,
          street: null,
          postalCode: null,
          city: null,
          passwordHash,
          isActive: false,
          // Fällt normalerweise schon aus `delete()` mit – bei direktem
          // Aufruf (Datenschutz-Modul inaktiv, siehe `delete()`) noch nicht
          // gesetzt, deshalb hier zur Sicherheit mit übernommen statt sich
          // auf den Aufrufer zu verlassen.
          deletedAt: existing.deletedAt ?? new Date(),
          anonymizedAt: new Date(),
        },
      }),
      this.prisma.refreshToken.updateMany({
        where: { userId: id, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);
  }

  // Sidebar-Kennzahlen auf der Profilseite (2b.14). Bewusst nur Inhalte +
  // Medien – die Bildvorlage zeigt zusätzlich "Formulare", das Modul gibt
  // es in dieser App nicht (kein erfundener Wert, siehe Konvention bei
  // der "2FA"-Spalte in der Benutzer-Tabelle).
  async getStats(id: string) {
    const [contentCount, mediaCount] = await Promise.all([
      this.prisma.content.count({
        where: { authorId: id, deletedAt: null },
      }),
      this.prisma.media.count({
        where: { uploadedById: id, deletedAt: null },
      }),
    ]);
    return { contentCount, mediaCount };
  }

  // "Verlauf" im "Aktivität"-Tab (2b.14-Nachtrag, 2026-08-17) – echte,
  // serverseitig paginierte Zeitleiste über AuditLogService.findForUser()
  // statt der Bildvorlage 1:1 zu folgen: "Formular veröffentlicht" fehlt
  // absichtlich (kein Formular-Modul in dieser App, siehe getStats() oben),
  // "Einladung angenommen" wurde durch den tatsächlichen Erstellungsweg
  // ersetzt (Admin-angelegt vs. Selbstregistrierung).
  async getActivity(id: string, page: number, pageSize: number) {
    return this.auditLog.findForUser(id, page, pageSize);
  }

  // CSV-Export des kompletten Aktivitätsverlaufs (Nutzervorgabe,
  // 2026-08-30: "bei benutzer aktivitäten als export ermöglichen") –
  // gleiches BOM-/Escaping-Muster wie SettingsService.
  // exportSettingsChangesCsv(), über AuditLogService.findAllForUser()
  // (unpaginierte Variante von findForUser() oben).
  async exportActivityCsv(id: string): Promise<string> {
    const rows = await this.auditLog.findAllForUser(id);
    const header = ['Datum', 'Aktion', 'Akteur'].join(',');
    const lines = rows.map((row) => {
      const actor = row.user
        ? `${row.user.firstName ?? ''} ${row.user.lastName}`.trim()
        : '';
      return [
        row.createdAt.toISOString(),
        describeAuditAction(row.action, row.metadata),
        actor,
      ]
        .map(csvEscape)
        .join(',');
    });
    return CSV_BOM + [header, ...lines].join('\n');
  }

  // "Diese Woche"-Kachel auf "Mein Konto" – anders als getStats() oben
  // (Lebenszeit-Summe für die admin-seitige Benutzer-Profilseite) auf die
  // laufende Kalenderwoche begrenzt. Wochenstart = Montag 00:00 lokale
  // Zeit, gängigste Konvention im deutschsprachigen Raum.
  async getWeeklyStats(id: string) {
    const now = new Date();
    const startOfWeek = new Date(now);
    const isoWeekday = (now.getDay() + 6) % 7; // Montag=0 .. Sonntag=6
    startOfWeek.setDate(now.getDate() - isoWeekday);
    startOfWeek.setHours(0, 0, 0, 0);

    const [contentCount, mediaCount] = await Promise.all([
      this.prisma.content.count({
        where: {
          authorId: id,
          createdAt: { gte: startOfWeek },
          deletedAt: null,
        },
      }),
      this.prisma.media.count({
        where: {
          uploadedById: id,
          createdAt: { gte: startOfWeek },
          deletedAt: null,
        },
      }),
    ]);
    return { contentCount, mediaCount };
  }

  // Self-Service-Avatar ("Foto ändern" auf "Mein Konto") – nutzt denselben
  // Upload-Mechanismus wie das Firmenlogo in den Einstellungen
  // (MediaService.create()), aber als eigener Endpunkt statt über
  // `POST /media`: jeder Nutzer darf sein eigenes Foto ändern, unabhängig
  // vom `media:create`-Recht, das z.B. die Rolle "Gast" nicht hat.
  // Landet im nicht löschbaren Systemordner "Avatare" (Nutzervorgabe,
  // 2026-08-17, gleiches Muster wie der "Logo"-Ordner) – der Ordner selbst
  // ist geschützt (`MediaFolder.isSystem`), einzelne Bilder darin lassen
  // sich aber ganz normal löschen.
  async updateAvatar(id: string, file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('Keine Datei übermittelt.');
    }
    const existing = await this.findOneRaw(id);
    const avatarFolder = await this.prisma.mediaFolder.findFirst({
      where: { name: 'Avatare', isSystem: true },
    });
    const media = await this.media.create(
      file,
      id,
      undefined,
      avatarFolder?.id,
    );
    const user = await this.prisma.user.update({
      where: { id },
      data: { avatarUrl: media.url },
      select: publicSelect,
    });

    // Vorheriges Profilfoto aufräumen (gleiches Muster wie beim Ersetzen des
    // Firmenlogos) – sonst sammeln sich im Avatare-Ordner bei jedem erneuten
    // Hochladen verwaiste Dateien an.
    if (existing.avatarUrl && existing.avatarUrl !== media.url) {
      const oldMedia = await this.prisma.media.findFirst({
        where: { url: existing.avatarUrl, uploadedById: id },
      });
      if (oldMedia) {
        await this.media.remove(oldMedia.id, id).catch(() => {});
      }
    }

    return toPublicUser(user);
  }

  // Ab wie vielen Fehlversuchen in Folge ein Nutzer als "auffällig" für die
  // Systembenachrichtigung zählt (siehe getNotificationCounts()).
  private static readonly FAILED_LOGIN_NOTIFICATION_THRESHOLD = 5;
  private static readonly NOTIFICATION_COUNTS_CACHE_KEY =
    'users:notification-counts';
  // Vorgabewert, falls die Einstellung nicht gelesen werden kann. 30s
  // statt live: läuft bei jeder Dashboard-Navigation für jeden Nutzer mit
  // `users:read` – bei vielen Konten (die App ist nicht auf eine kleine,
  // feste Admin-Zahl beschränkt, siehe Schema-Kommentar zu
  // `User.pendingActivation`) sonst unnötig viele COUNT-Abfragen.
  //
  // Seit 2026-09-03 ist die Dauer unter Einstellungen → Caching
  // einstellbar und der Cache dort auch ganz abschaltbar; dieser Wert
  // greift nur noch als Rückfall.
  private static readonly NOTIFICATION_COUNTS_CACHE_TTL_MS = 30_000;

  // Rohe Zähler für die Systembenachrichtigungen-Karte (2b.14). Zwei
  // Performance-Maßnahmen (Nutzervorgabe, 2026-08-16, "bei vielen Nutzern"):
  // 1) Ergebnis wird zwischengespeichert (siehe CacheService, per
  //    "Backend-Cache leeren" unter Einstellungen → Caching manuell
  //    löschbar).
  // 2) Für eine per `AppSettings.notify*` deaktivierte Kategorie wird gar
  //    nicht erst gezählt (0 ohne Query) – "nicht nur ausblenden, sondern
  //    das Erfassen beenden".
  //
  // Die Einstellungen werden VOR dem Cache-Zugriff gelesen, nicht in der
  // Factory: die Dauer muss feststehen, bevor gecacht wird, und bei
  // abgeschaltetem Cache soll gar nicht erst nachgeschlagen werden. Der
  // Aufruf ist billig, `SettingsService.get()` cacht selbst.
  async getNotificationCounts() {
    const settings = await this.settings.get();
    const compute = async () => {
      const [pendingActivation, failedLogins, pendingPasswordChange] =
        await Promise.all([
          settings.notifyPendingActivations
            ? this.prisma.user.count({
                where: { pendingActivation: true, anonymizedAt: null },
              })
            : Promise.resolve(0),
          settings.notifyFailedLogins
            ? this.prisma.user.count({
                where: {
                  failedLoginAttempts: {
                    gte: UsersService.FAILED_LOGIN_NOTIFICATION_THRESHOLD,
                  },
                  isActive: true,
                  anonymizedAt: null,
                },
              })
            : Promise.resolve(0),
          settings.notifyPendingPasswordChanges
            ? this.prisma.user.count({
                where: {
                  mustChangePassword: true,
                  isActive: true,
                  anonymizedAt: null,
                },
              })
            : Promise.resolve(0),
        ]);
      return { pendingActivation, failedLogins, pendingPasswordChange };
    };

    if (!settings.backendCacheEnabled) return compute();
    return this.cache.getOrSet(
      UsersService.NOTIFICATION_COUNTS_CACHE_KEY,
      (settings.backendCacheTtlSeconds ?? 30) * 1000 ||
        UsersService.NOTIFICATION_COUNTS_CACHE_TTL_MS,
      compute,
    );
  }

  /** Datenschutz → Tab "Nutzer": alle gelöschten, noch nicht anonymisierten
   * Konten (nicht nur die schon überfälligen wie zuvor – "und dann taucht
   * er nichtmal in datenschutz im reiter gelöschte nutzer auf", Nutzer-
   * Bugreport 2026-08-21). `retentionMonths` dient sowohl der `overdue`-
   * Markierung als auch (Nutzervorgabe, 2026-08-29: "je Benutzer eine
   * Zeitanzeige, wann anonymisiert werden muss, wie bei Papierkorb") der
   * individuellen Deadline pro Nutzer (`deletedAt` + `retentionMonths`,
   * analog zu `TrashService.withExpiryMeta`s `deletedAt` + `retentionDays`
   * – dort in Tagen, hier in Monaten, da `retentionDeactivatedAccountsMonths`
   * so konfiguriert wird). */
  async findDeleted(retentionMonths: number) {
    const rows = await this.prisma.user.findMany({
      where: { deletedAt: { not: null }, anonymizedAt: null },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        deletedAt: true,
      },
      orderBy: { deletedAt: 'asc' },
    });
    const now = Date.now();
    const MS_PER_DAY = 24 * 60 * 60 * 1000;
    return rows.map((u) => {
      const deadlineAt = new Date(u.deletedAt!);
      deadlineAt.setMonth(deadlineAt.getMonth() + retentionMonths);
      const daysLeft = Math.ceil((deadlineAt.getTime() - now) / MS_PER_DAY);
      return { ...u, deadlineAt, daysLeft, overdue: daysLeft <= 0 };
    });
  }

  private async findOneRaw(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundException(`Benutzer ${id} nicht gefunden.`);
    }
    return user;
  }

  // Rollenabhängig statt eines einzelnen globalen Schalters (Nutzervorgabe,
  // 2026-08-21): Pivot darf immer ändern ("kann alles"), Administrator
  // über den eigenen Schalter `allowAdminEmailChange` ("als Option in den
  // Einstellungen"), Manager nie (kein eigener Schalter, "manager nicht"),
  // alle übrigen Rollen über den bestehenden `allowEmailChange`
  // ("Benutzer können E-Mail-Adresse anpassen").
  private async assertEmailChangeAllowed(
    newEmail: string,
    actingUser: JwtPayload,
  ) {
    const settings = await this.settings.get();
    const roleNames = actingUser.roleNames;
    const allowed = roleNames.includes('Pivot')
      ? true
      : roleNames.includes('Administrator')
        ? settings.allowAdminEmailChange
        : roleNames.includes('Manager')
          ? false
          : settings.allowEmailChange;
    if (!allowed) {
      throw new BadRequestException(
        'Ändern der E-Mail-Adresse ist derzeit deaktiviert.',
      );
    }
    const conflict = await this.prisma.user.findUnique({
      where: { email: newEmail },
    });
    if (conflict) {
      throw new ConflictException(
        'E-Mail-Adresse wird bereits von einem anderen Benutzer verwendet.',
      );
    }
  }
}
