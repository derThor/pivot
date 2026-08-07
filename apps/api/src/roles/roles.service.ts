import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@strasev/database';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { QueryRoleDto } from './dto/query-role.dto';
import { PERMISSIONS_CATALOG } from './permissions.catalog';

function toPermissionKey(p: { resource: string; action: string }): string {
  return `${p.resource}:${p.action}`;
}

const roleInclude = {
  permissions: { include: { permission: true } },
  _count: { select: { users: true } },
} satisfies Prisma.RoleInclude;

type RoleWithPermissions = Prisma.RoleGetPayload<{ include: typeof roleInclude }>;

function serializeRole(role: RoleWithPermissions) {
  return {
    id: role.id,
    name: role.name,
    description: role.description,
    isSystem: role.isSystem,
    isDefault: role.isDefault,
    canAccessDashboard: role.canAccessDashboard,
    userCount: role._count.users,
    permissions: role.permissions.map((rp) => toPermissionKey(rp.permission)),
  };
}

@Injectable()
export class RolesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: QueryRoleDto) {
    const { page, pageSize } = query;
    const [roles, total] = await Promise.all([
      this.prisma.role.findMany({
        include: roleInclude,
        orderBy: { name: 'asc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.role.count(),
    ]);
    return {
      items: roles.map(serializeRole),
      meta: { page, pageSize, total, pageCount: Math.ceil(total / pageSize) },
    };
  }

  /** Ermittelt, auf welcher Seite (bei gegebener pageSize) ein Eintrag liegt. */
  async findPage(id: string, pageSize: number) {
    const target = await this.prisma.role.findUniqueOrThrow({ where: { id } });
    const rank = await this.prisma.role.count({
      where: { name: { lt: target.name } },
    });
    return { page: Math.floor(rank / pageSize) + 1 };
  }

  async findOne(id: string) {
    const role = await this.prisma.role.findUnique({
      where: { id },
      include: roleInclude,
    });
    if (!role) {
      throw new NotFoundException(`Rolle ${id} nicht gefunden.`);
    }
    return serializeRole(role);
  }

  async create(dto: CreateRoleDto) {
    const existing = await this.prisma.role.findUnique({
      where: { name: dto.name },
    });
    if (existing) {
      throw new ConflictException(
        'Eine Rolle mit diesem Namen existiert bereits.',
      );
    }

    const permissionIds = await this.resolvePermissionIds(dto.permissions);
    const role = await this.prisma.role.create({
      data: {
        name: dto.name,
        description: dto.description,
        canAccessDashboard: dto.canAccessDashboard ?? true,
        permissions: {
          create: permissionIds.map((permissionId) => ({ permissionId })),
        },
      },
      include: roleInclude,
    });
    return serializeRole(role);
  }

  async update(id: string, dto: UpdateRoleDto) {
    const role = await this.prisma.role.findUnique({ where: { id } });
    if (!role) {
      throw new NotFoundException(`Rolle ${id} nicht gefunden.`);
    }

    if (dto.name && dto.name !== role.name) {
      const conflict = await this.prisma.role.findUnique({
        where: { name: dto.name },
      });
      if (conflict) {
        throw new ConflictException(
          'Eine Rolle mit diesem Namen existiert bereits.',
        );
      }
    }

    if (dto.permissions) {
      const permissionIds = await this.resolvePermissionIds(dto.permissions);
      await this.prisma.rolePermission.deleteMany({ where: { roleId: id } });
      await this.prisma.rolePermission.createMany({
        data: permissionIds.map((permissionId) => ({
          roleId: id,
          permissionId,
        })),
      });
    }

    const updated = await this.prisma.role.update({
      where: { id },
      data: {
        ...(dto.name && { name: dto.name }),
        ...(dto.description !== undefined && {
          description: dto.description,
        }),
        ...(dto.canAccessDashboard !== undefined && {
          canAccessDashboard: dto.canAccessDashboard,
        }),
      },
      include: roleInclude,
    });
    return serializeRole(updated);
  }

  async remove(id: string) {
    const role = await this.prisma.role.findUnique({
      where: { id },
      include: { _count: { select: { users: true } } },
    });
    if (!role) {
      throw new NotFoundException(`Rolle ${id} nicht gefunden.`);
    }
    if (role.isSystem) {
      throw new BadRequestException(
        'System-Rollen können nicht gelöscht werden.',
      );
    }
    if (role._count.users > 0) {
      throw new BadRequestException(
        'Rolle ist noch Benutzern zugewiesen und kann nicht gelöscht werden.',
      );
    }
    await this.prisma.role.delete({ where: { id } });
  }

  getPermissionsCatalog() {
    return PERMISSIONS_CATALOG.map(toPermissionKey);
  }

  private async resolvePermissionIds(keys: string[]): Promise<string[]> {
    if (keys.length === 0) return [];
    const permissions = await this.prisma.permission.findMany({
      where: {
        OR: keys.map((key) => {
          const [resource, action] = key.split(':');
          return { resource, action };
        }),
      },
    });
    if (permissions.length !== keys.length) {
      throw new BadRequestException('Mindestens ein Recht ist unbekannt.');
    }
    return permissions.map((p) => p.id);
  }
}
