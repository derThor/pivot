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
import { NavigationService } from './navigation.service';
import { CreateNavigationDto } from './dto/create-navigation.dto';
import { UpdateNavigationDto } from './dto/update-navigation.dto';
import { CreateNavigationItemDto } from './dto/create-navigation-item.dto';
import { UpdateNavigationItemDto } from './dto/update-navigation-item.dto';
import { ReorderNavigationItemsDto } from './dto/reorder-navigation-items.dto';
import { QueryNavigationDto } from './dto/query-navigation.dto';
import { RequirePermission } from '../auth/decorators/permissions.decorator';

// Navigationen sind site-weite Struktur-Konfiguration (analog zu
// Webhooks), keine editorielle Content-Ressource. Eigenes `navigation`-
// Rechte-Bündel statt des groben `settings:manage` (Rollen-&-Rechte-
// Neubau, 2026-08-16, siehe knowledge-base/auth/rbac-rework.md).
@ApiTags('navigation')
@ApiBearerAuth()
@Controller('navigations')
export class NavigationController {
  constructor(private readonly navigationService: NavigationService) {}

  @RequirePermission('navigation:read')
  @Get()
  findAll(@Query() query: QueryNavigationDto) {
    return this.navigationService.findAll(query);
  }

  @RequirePermission('navigation:read')
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.navigationService.findOne(id);
  }

  @RequirePermission('navigation:update')
  @Post()
  create(@Body() dto: CreateNavigationDto) {
    return this.navigationService.create(dto);
  }

  @RequirePermission('navigation:update')
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateNavigationDto) {
    return this.navigationService.update(id, dto);
  }

  @RequirePermission('navigation:update')
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.navigationService.remove(id);
  }

  @RequirePermission('navigation:update')
  @Post(':id/items')
  createItem(
    @Param('id') navigationId: string,
    @Body() dto: CreateNavigationItemDto,
  ) {
    return this.navigationService.createItem(navigationId, dto);
  }

  @RequirePermission('navigation:reorder')
  @Patch(':id/items/reorder')
  reorderItems(
    @Param('id') navigationId: string,
    @Body() dto: ReorderNavigationItemsDto,
  ) {
    return this.navigationService.reorderItems(navigationId, dto);
  }

  @RequirePermission('navigation:update')
  @Patch(':id/items/:itemId')
  updateItem(
    @Param('id') navigationId: string,
    @Param('itemId') itemId: string,
    @Body() dto: UpdateNavigationItemDto,
  ) {
    return this.navigationService.updateItem(navigationId, itemId, dto);
  }

  @RequirePermission('navigation:update')
  @Delete(':id/items/:itemId')
  removeItem(
    @Param('id') navigationId: string,
    @Param('itemId') itemId: string,
  ) {
    return this.navigationService.removeItem(navigationId, itemId);
  }
}
