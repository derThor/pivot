import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { NavigationService } from './navigation.service';
import { CreateNavigationDto } from './dto/create-navigation.dto';
import { UpdateNavigationDto } from './dto/update-navigation.dto';
import { CreateNavigationItemDto } from './dto/create-navigation-item.dto';
import { UpdateNavigationItemDto } from './dto/update-navigation-item.dto';
import { ReorderNavigationItemsDto } from './dto/reorder-navigation-items.dto';
import { RequirePermission } from '../auth/decorators/permissions.decorator';

// Navigationen sind site-weite Struktur-Konfiguration (analog zu
// Webhooks), keine editorielle Content-Ressource – deshalb gegated über
// dieselbe `settings:manage`-Permission wie der Rest von /settings.
@ApiTags('navigation')
@ApiBearerAuth()
@RequirePermission('settings:manage')
@Controller('navigations')
export class NavigationController {
  constructor(private readonly navigationService: NavigationService) {}

  @Get()
  findAll() {
    return this.navigationService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.navigationService.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateNavigationDto) {
    return this.navigationService.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateNavigationDto) {
    return this.navigationService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.navigationService.remove(id);
  }

  @Post(':id/items')
  createItem(
    @Param('id') navigationId: string,
    @Body() dto: CreateNavigationItemDto,
  ) {
    return this.navigationService.createItem(navigationId, dto);
  }

  @Patch(':id/items/reorder')
  reorderItems(
    @Param('id') navigationId: string,
    @Body() dto: ReorderNavigationItemsDto,
  ) {
    return this.navigationService.reorderItems(navigationId, dto);
  }

  @Patch(':id/items/:itemId')
  updateItem(
    @Param('id') navigationId: string,
    @Param('itemId') itemId: string,
    @Body() dto: UpdateNavigationItemDto,
  ) {
    return this.navigationService.updateItem(navigationId, itemId, dto);
  }

  @Delete(':id/items/:itemId')
  removeItem(
    @Param('id') navigationId: string,
    @Param('itemId') itemId: string,
  ) {
    return this.navigationService.removeItem(navigationId, itemId);
  }
}
