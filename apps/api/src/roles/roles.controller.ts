import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { RolesService } from './roles.service';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { QueryRoleDto } from './dto/query-role.dto';
import { RequirePermission } from '../auth/decorators/permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/strategies/jwt.strategy';
import { FindPageDto } from '../common/dto/find-page.dto';

@ApiTags('roles')
@ApiBearerAuth()
@Controller('roles')
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @RequirePermission('roles:read')
  @Get()
  findAll(@Query() query: QueryRoleDto, @CurrentUser() user: JwtPayload) {
    return this.rolesService.findAll(query, user);
  }

  @RequirePermission('roles:read')
  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.rolesService.findOne(id, user);
  }

  @RequirePermission('roles:read')
  @Get(':id/page')
  findPage(
    @Param('id') id: string,
    @Query() query: FindPageDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.rolesService.findPage(id, query.pageSize, user);
  }

  @RequirePermission('roles:create')
  @Post()
  create(@Body() dto: CreateRoleDto, @CurrentUser() user: JwtPayload) {
    return this.rolesService.create(dto, user);
  }

  @RequirePermission('roles:update')
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateRoleDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.rolesService.update(id, dto, user);
  }

  // Kein eigenes `roles:delete` im Katalog – Löschen ist Teil der
  // "bestehende Rollen pflegen"-Fähigkeit (`roles:update`), analog zu
  // `users:update`, das auch keine eigene Delete-Variante hat.
  @RequirePermission('roles:update')
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.rolesService.remove(id);
  }
}
