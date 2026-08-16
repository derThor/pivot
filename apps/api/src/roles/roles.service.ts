import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@pivot/database';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { QueryRoleDto } from './dto/query-role.dto';
import {
  PERMISSIONS_CATALOG,
  PERMISSION_CATEGORY_BY_RESOURCE,
} from './permissions.catalog';

function toPermissionKey(p: { resource: string; action: string }): string {
  return `${p.resource}:${p.action}`;
}

const roleInclude = {
  permissions: { include: { permission: true } },
  _count: { select: { userRoles: true } },
} satisfies Prisma.RoleInclude;

type RoleWithPermissions = Prisma.RoleGetPayload<{
  include: typeof roleInclude;
}>;

function serializeRole(role: RoleWithPermissions) {
  return {
    id: role.id,
    name: role.name,
    description: role.description,
    isSystem: role.isSystem,
    isDefault: role.isDefault,
    canAccessDashboard: role.canAccessDashboard,
    userCount: role._count.userRoles,
    updatedAt: role.updatedAt,
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
        orderBy: { sortOrder: 'asc' },
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
      where: { sortOrder: { lt: target.sortOrder } },
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
    // Neue Rollen landen immer unter allen bestehenden (Nutzervorgabe,
    // 2026-08-16: Administrator/Manager/Redakteur/Gast bleiben fix oben,
    // jede neue Rolle kommt darunter) – ohne das würde `sortOrder` auf den
    // Schema-Default `0` fallen und mit Administrator kollidieren.
    const maxSortOrder = await this.prisma.role.aggregate({
      _max: { sortOrder: true },
    });
    const role = await this.prisma.role.create({
      data: {
        name: dto.name,
        description: dto.description,
        canAccessDashboard: dto.canAccessDashboard ?? true,
        sortOrder: (maxSortOrder._max.sortOrder ?? -1) + 1,
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
      include: { _count: { select: { userRoles: true } } },
    });
    if (!role) {
      throw new NotFoundException(`Rolle ${id} nicht gefunden.`);
    }
    if (role.isSystem) {
      throw new BadRequestException(
        'System-Rollen können nicht gelöscht werden.',
      );
    }
    if (role._count.userRoles > 0) {
      throw new BadRequestException(
        'Rolle ist noch Benutzern zugewiesen und kann nicht gelöscht werden.',
      );
    }
    await this.prisma.role.delete({ where: { id } });
  }

  getPermissionsCatalog() {
    return PERMISSIONS_CATALOG.map((p) => ({
      resource: p.resource,
      action: p.action,
      key: toPermissionKey(p),
      category: PERMISSION_CATEGORY_BY_RESOURCE[p.resource],
    }));
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
