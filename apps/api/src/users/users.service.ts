import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as argon2 from 'argon2';
import { PrismaService } from '../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';
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
  isActive: true,
  emailVerifiedAt: true,
  createdAt: true,
  updatedAt: true,
  role: { select: { id: true, name: true } },
} as const;

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
  ) {}

  async findAll(query: QueryUserDto) {
    const { page, pageSize, roleId } = query;
    const where = roleId ? { roleId } : undefined;
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
      items,
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
    return user;
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
    roleId: string | undefined,
  ) {
    if (!roleId || actingUser.roleName === 'Administrator') return;
    const role = await this.prisma.role.findUnique({
      where: { id: roleId },
      select: { name: true },
    });
    if (role?.name === 'Administrator') {
      throw new ForbiddenException(
        'Nur Administratoren können die Administrator-Rolle vergeben.',
      );
    }
  }

  async create(dto: CreateUserDto, actingUser: JwtPayload) {
    await this.assertMayAssignRole(actingUser, dto.roleId);
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

    const roleId =
      dto.roleId ??
      (await this.prisma.role.findFirstOrThrow({ where: { isDefault: true } }))
        .id;
    const passwordHash = await argon2.hash(dto.password);

    return this.prisma.user.create({
      data: {
        email: dto.email,
        firstName: dto.firstName,
        lastName: dto.lastName,
        roleId,
        passwordHash,
      },
      select: publicSelect,
    });
  }

  async update(id: string, dto: UpdateUserDto, actingUser: JwtPayload) {
    await this.assertMayAssignRole(actingUser, dto.roleId);
    const existing = await this.findOneRaw(id);

    if (dto.email && dto.email !== existing.email) {
      await this.assertEmailChangeAllowed(dto.email);
    }
    if (dto.roleId) {
      const role = await this.prisma.role.findUnique({
        where: { id: dto.roleId },
      });
      if (!role) {
        throw new BadRequestException('Rolle nicht gefunden.');
      }
    }

    return this.prisma.user.update({
      where: { id },
      data: dto,
      select: publicSelect,
    });
  }

  async updateProfile(id: string, dto: UpdateProfileDto) {
    const existing = await this.findOneRaw(id);

    if (dto.email && dto.email !== existing.email) {
      await this.assertEmailChangeAllowed(dto.email);
    }

    return this.prisma.user.update({
      where: { id },
      data: dto,
      select: publicSelect,
    });
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
