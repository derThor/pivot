import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@pivot/database';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { QueryRoleDto } from './dto/query-role.dto';
import type { JwtPayload } from '../auth/strategies/jwt.strategy';
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

  // Pivot ist für alle außer Pivot selbst unsichtbar (Nutzervorgabe,
  // 2026-08-21: "die rolle pivot soll nur von der rolle pivot gesehen
  // werden") – nicht nur schreibgeschützt wie Administrator, sondern
  // taucht in der Rollen-Liste/-Detailansicht gar nicht erst auf.
  private hidePivotFilter(actingUser: JwtPayload): Prisma.RoleWhereInput {
    return actingUser.roleNames.includes('Pivot')
      ? {}
      : { name: { not: 'Pivot' } };
  }

  async findAll(query: QueryRoleDto, actingUser: JwtPayload) {
    const { page, pageSize } = query;
    const where = this.hidePivotFilter(actingUser);
    const [roles, total] = await Promise.all([
      this.prisma.role.findMany({
        where,
        include: roleInclude,
        orderBy: { sortOrder: 'asc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.role.count({ where }),
    ]);
    return {
      items: roles.map(serializeRole),
      meta: { page, pageSize, total, pageCount: Math.ceil(total / pageSize) },
    };
  }

  /** Ermittelt, auf welcher Seite (bei gegebener pageSize) ein Eintrag liegt. */
  async findPage(id: string, pageSize: number, actingUser: JwtPayload) {
    const target = await this.prisma.role.findFirstOrThrow({
      where: { id, ...this.hidePivotFilter(actingUser) },
    });
    const rank = await this.prisma.role.count({
      where: {
        sortOrder: { lt: target.sortOrder },
        ...this.hidePivotFilter(actingUser),
      },
    });
    return { page: Math.floor(rank / pageSize) + 1 };
  }

  async findOne(id: string, actingUser: JwtPayload) {
    const role = await this.prisma.role.findUnique({
      where: { id },
      include: roleInclude,
    });
    if (!role) {
      throw new NotFoundException(`Rolle ${id} nicht gefunden.`);
    }
    if (role.name === 'Pivot' && !actingUser.roleNames.includes('Pivot')) {
      // Bewusst dieselbe NotFoundException wie "existiert nicht" – kein
      // 403, das würde die Existenz der Rolle verraten.
      throw new NotFoundException(`Rolle ${id} nicht gefunden.`);
    }
    return serializeRole(role);
  }

  // `roles:update`/`roles:create` erlauben grundsätzlich auch Administrator
  // (siehe Rollen-Katalog), sonst könnte sich ein Administrator über die
  // Rollenverwaltung selbst wieder `settings:*` zuweisen und die per
  // Rollen-Seed entzogenen Einstellungs-Rechte umgehen (Nutzervorgabe,
  // 2026-08-21: "einstellungen können nur pivot machen. keine admins") –
  // nur ein bereits als Pivot angemeldeter Nutzer darf `settings:*` an
  // irgendeine Rolle vergeben, unabhängig davon, welche Rolle bearbeitet
  // wird. Frontend blendet die Administrator-Rolle nur zusätzlich als
  // schreibgeschützt aus (UX), ist aber kein Ersatz für diese Prüfung.
  private assertMaySetSettingsPermissions(
    permissionKeys: string[],
    actingUser: JwtPayload,
  ) {
    const touchesSettings = permissionKeys.some((k) =>
      k.startsWith('settings:'),
    );
    if (touchesSettings && !actingUser.roleNames.includes('Pivot')) {
      throw new ForbiddenException(
        'Nur Pivot kann Einstellungs-Rechte vergeben.',
      );
    }
  }

  async create(dto: CreateRoleDto, actingUser: JwtPayload) {
    this.assertMaySetSettingsPermissions(dto.permissions, actingUser);
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
        // Neue Rollen starten ohne Dashboard-Zugriff – muss aktiv gesetzt
        // werden (Nutzervorgabe, 2026-08-19), unabhängig davon, ob die
        // Rolle über den Dialog oder direkt über die API angelegt wird.
        canAccessDashboard: dto.canAccessDashboard ?? false,
        sortOrder: (maxSortOrder._max.sortOrder ?? -1) + 1,
        permissions: {
          create: permissionIds.map((permissionId) => ({ permissionId })),
        },
      },
      include: roleInclude,
    });
    return serializeRole(role);
  }

  async update(id: string, dto: UpdateRoleDto, actingUser: JwtPayload) {
    if (dto.permissions) {
      this.assertMaySetSettingsPermissions(dto.permissions, actingUser);
    }
    const role = await this.prisma.role.findUnique({ where: { id } });
    if (!role) {
      throw new NotFoundException(`Rolle ${id} nicht gefunden.`);
    }

    if (dto.name && dto.name !== role.name) {
      // System-Rollen (Pivot/Administrator/Manager/Redakteur/Gast) dürfen
      // nicht umbenannt werden: die Sonderbehandlungen dieser Rollen im
      // ganzen Code (assertMayAssignRole, assertMaySetSettingsPermissions,
      // Impersonation-Sperre, 2FA-Pflicht, Frontend-Schreibschutz) greifen
      // namensbasiert. Ohne dieses Verbot könnte z.B. ein Administrator
      // (hat weiterhin `roles:update`) die echte Pivot-Rolle umbenennen und
      // sich die – dadurch namentlich "entschützte", aber weiterhin voll
      // berechtigte – Rolle anschließend selbst zuweisen (Nutzerfrage,
      // 2026-08-21: "kann irgendeine rolle außer pivot einen user oder
      // sich selber die rolle pivot geben?"). Pivot selbst ist von dieser
      // Sperre ausgenommen ("pivot kann alles", 2026-08-21) – die Sperre
      // schützt nur davor, dass sich JEMAND ANDERES als Pivot auf diesem
      // Weg an Pivots Rechte heranarbeitet, nicht Pivot selbst.
      if (role.isSystem && !actingUser.roleNames.includes('Pivot')) {
        throw new BadRequestException(
          'System-Rollen können nicht umbenannt werden.',
        );
      }
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
