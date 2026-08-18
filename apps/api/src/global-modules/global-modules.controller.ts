import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { GlobalModulesService } from './global-modules.service';
import { CreateGlobalModuleDto } from './dto/create-global-module.dto';
import { UpdateGlobalModuleDto } from './dto/update-global-module.dto';
import { QueryGlobalModuleDto } from './dto/query-global-module.dto';
import { Public } from '../auth/decorators/public.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { FindPageDto } from '../common/dto/find-page.dto';
import type { JwtPayload } from '../auth/strategies/jwt.strategy';

// Globale Module sind generisch über `moduleTypeId` typisiert (aktuell
// genutzt für Galerien/FAQs) – es gibt keine eigene Permission-Ressource
// dafür im Katalog, das passende Recht (`gallery:*`/`faq:*`) hängt vom
// referenzierten Modul-Typ ab. Da `@RequirePermission` nur ein statisches
// Recht pro Route kennt, wird hier manuell geprüft (Rollen-&-Rechte-Neubau,
// 2026-08-16, siehe knowledge-base/auth/rbac-rework.md), analog zum
// bestehenden `unlock()`-Check in ContentController. Lesen bleibt
// `@Public()`: die anonyme Vorschau-Seite (`/preview/[token]`) muss die
// aktuellen Werte live auflösen können, exakt derselbe Grund wie bei
// `ModuleTypesController`.
@ApiTags('global-modules')
@ApiBearerAuth()
@Controller('global-modules')
export class GlobalModulesController {
  constructor(private readonly globalModulesService: GlobalModulesService) {}

  // `settings` kennt im Katalog nur `read`/`update` (kein `create`/`delete`)
  // – der Fallback für Nicht-Galerie/FAQ-Modultypen bildet deshalb jede
  // mutierende Aktion auf `settings:update` ab statt auf eine Aktion, die
  // niemand je besitzen könnte.
  private toPermissionKey(
    resource: string,
    action: 'read' | 'create' | 'update' | 'delete',
  ): string {
    if (resource === 'settings') {
      return action === 'read' ? 'settings:read' : 'settings:update';
    }
    return `${resource}:${action}`;
  }

  private assertPermission(user: JwtPayload, key: string) {
    if (!user.permissions.includes(key)) {
      throw new ForbiddenException(`Fehlende Berechtigung: ${key}`);
    }
  }

  @Public()
  @Get()
  findAll(@Query() query: QueryGlobalModuleDto) {
    return this.globalModulesService.findAll(query);
  }

  @Public()
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.globalModulesService.findOne(id);
  }

  @Get(':id/page')
  async findPage(
    @Param('id') id: string,
    @Query() query: FindPageDto,
    @CurrentUser() user: JwtPayload,
  ) {
    const resource =
      await this.globalModulesService.resolveResourceForModule(id);
    this.assertPermission(user, this.toPermissionKey(resource, 'read'));
    return this.globalModulesService.findPage(id, query.pageSize);
  }

  @Post()
  async create(
    @Body() dto: CreateGlobalModuleDto,
    @CurrentUser() user: JwtPayload,
  ) {
    const resource = await this.globalModulesService.resolveResource(
      dto.moduleTypeId,
    );
    this.assertPermission(user, this.toPermissionKey(resource, 'create'));
    return this.globalModulesService.create(dto);
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateGlobalModuleDto,
    @CurrentUser() user: JwtPayload,
  ) {
    const resource =
      await this.globalModulesService.resolveResourceForModule(id);
    this.assertPermission(user, this.toPermissionKey(resource, 'update'));
    return this.globalModulesService.update(id, dto);
  }

  @Delete(':id')
  async remove(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    const resource =
      await this.globalModulesService.resolveResourceForModule(id);
    this.assertPermission(user, this.toPermissionKey(resource, 'delete'));
    return this.globalModulesService.remove(id, user.sub);
  }

  @Post(':id/restore')
  async restore(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    const resource =
      await this.globalModulesService.resolveResourceForModule(id);
    this.assertPermission(user, this.toPermissionKey(resource, 'delete'));
    return this.globalModulesService.restore(id);
  }

  @Delete(':id/permanent')
  async permanentDelete(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    const resource =
      await this.globalModulesService.resolveResourceForModule(id);
    this.assertPermission(user, this.toPermissionKey(resource, 'delete'));
    return this.globalModulesService.permanentDelete(id);
  }
}
