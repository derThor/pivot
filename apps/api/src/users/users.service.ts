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
import { validatePasswordAgainstPolicy } from '../settings/password-policy';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { QueryUserDto } from './dto/query-user.dto';
import type { JwtPayload } from '../auth/strategies/jwt.strategy';

const publicSelect = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  avatarUrl: true,
  department: true,
  phone: true,
  isActive: true,
  emailVerifiedAt: true,
  lastLoginAt: true,
  mustChangePassword: true,
  failedLoginAttempts: true,
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
  ) {}

  async findAll(query: QueryUserDto) {
    const { page, pageSize, roleId, isActive, q } = query;
    const where = {
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

  // Nur Administratoren dürfen die Administrator-Rolle vergeben
  // (Nutzervorgabe, 2026-08-16) – `users:update`/`users:invite` allein
  // hätten sonst z.B. Manager erlaubt, sich oder andere zum Admin zu
  // machen (`roles:read` reicht, um die Rollen-ID zu ermitteln).
  // Namensbasiert wie `isAdministrator`-Checks im Frontend, da
  // Administrator die einzige Rolle ist, die diese Sonderbehandlung
  // braucht.
  private async assertMayAssignRole(
    actingUser: JwtPayload,
    roleIds: string[] | undefined,
  ) {
    if (!roleIds?.length || actingUser.roleNames.includes('Administrator')) {
      return;
    }
    const roles = await this.prisma.role.findMany({
      where: { id: { in: roleIds } },
      select: { name: true },
    });
    if (roles.some((role) => role.name === 'Administrator')) {
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

    const settings = await this.settings.get();
    const violations = validatePasswordAgainstPolicy(dto.password, settings);
    if (violations.length > 0) {
      throw new BadRequestException(violations.join(' '));
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
    const passwordHash = await argon2.hash(dto.password);

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
      await this.assertEmailChangeAllowed(dto.email);
    }
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
    }

    const { roleIds, ...rest } = dto;
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id },
        // `pendingActivation` verschwindet automatisch, sobald ein Admin
        // den Nutzer aktiviert (siehe Schema-Kommentar zu `User.pendingActivation`).
        data: rest.isActive ? { ...rest, pendingActivation: false } : rest,
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
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id },
      select: publicSelect,
    });
    return toPublicUser(user);
  }

  async updateProfile(id: string, dto: UpdateProfileDto) {
    const existing = await this.findOneRaw(id);

    if (dto.email && dto.email !== existing.email) {
      await this.assertEmailChangeAllowed(dto.email);
    }

    const user = await this.prisma.user.update({
      where: { id },
      data: dto,
      select: publicSelect,
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
      this.prisma.user.update({ where: { id }, data: { isActive: false } }),
      this.prisma.refreshToken.updateMany({
        where: { userId: id, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);
  }

  // "Benutzer löschen" / "Konto entfernen" (2b.14, Nutzerentscheidung
  // 2026-08-16): beide Stellen der Bildvorlage nutzen dieselbe Aktion.
  // Anders als `remove()` oben NICHT reversibel – entfernt alle
  // personenbezogenen Daten, behält aber Zeile/`id`, damit
  // `contents_authorId_fkey` & Co. gültig bleiben (siehe
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
          passwordHash,
          isActive: false,
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
      this.prisma.content.count({ where: { authorId: id } }),
      this.prisma.media.count({ where: { uploadedById: id } }),
    ]);
    return { contentCount, mediaCount };
  }

  // Ab wie vielen Fehlversuchen in Folge ein Nutzer als "auffällig" für die
  // Systembenachrichtigung zählt (siehe getNotificationCounts()).
  private static readonly FAILED_LOGIN_NOTIFICATION_THRESHOLD = 5;
  private static readonly NOTIFICATION_COUNTS_CACHE_KEY =
    'users:notification-counts';
  // 30s statt live: läuft bei jeder Dashboard-Navigation für jeden Nutzer
  // mit `users:read` – bei vielen Konten (die App ist nicht auf eine
  // kleine, feste Admin-Zahl beschränkt, siehe Schema-Kommentar zu
  // `User.pendingActivation`) sonst unnötig viele COUNT-Abfragen.
  private static readonly NOTIFICATION_COUNTS_CACHE_TTL_MS = 30_000;

  // Rohe Zähler für die Systembenachrichtigungen-Karte (2b.14). Zwei
  // Performance-Maßnahmen (Nutzervorgabe, 2026-08-16, "bei vielen Nutzern"):
  // 1) Ergebnis wird für NOTIFICATION_COUNTS_CACHE_TTL_MS gecacht (siehe
  //    CacheService, per "Cache leeren" unter Einstellungen manuell
  //    löschbar).
  // 2) Für eine per `AppSettings.notify*` deaktivierte Kategorie wird gar
  //    nicht erst gezählt (0 ohne Query) – "nicht nur ausblenden, sondern
  //    das Erfassen beenden".
  async getNotificationCounts() {
    return this.cache.getOrSet(
      UsersService.NOTIFICATION_COUNTS_CACHE_KEY,
      UsersService.NOTIFICATION_COUNTS_CACHE_TTL_MS,
      async () => {
        const settings = await this.settings.get();
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
      },
    );
  }

  private async findOneRaw(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundException(`Benutzer ${id} nicht gefunden.`);
    }
    return user;
  }

  private async assertEmailChangeAllowed(newEmail: string) {
    const settings = await this.settings.get();
    if (!settings.allowEmailChange) {
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
