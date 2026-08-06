import {
  BadRequestException,
  ConflictException,
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
    const { page, pageSize } = query;
    const [items, total] = await Promise.all([
      this.prisma.user.findMany({
        select: publicSelect,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.user.count(),
    ]);
    return {
      items,
      meta: { page, pageSize, total, pageCount: Math.ceil(total / pageSize) },
    };
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

  async create(dto: CreateUserDto) {
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

  async update(id: string, dto: UpdateUserDto) {
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

  async remove(id: string, currentUserId: string) {
    if (id === currentUserId) {
      throw new BadRequestException(
        'Du kannst dein eigenes Konto nicht löschen.',
      );
    }
    await this.findOne(id);
    await this.prisma.user.delete({ where: { id } });
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
