import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { MandantenService } from './mandanten.service';
import { CreateMandantDto } from './dto/create-mandant.dto';
import { UpdateMandantDto } from './dto/update-mandant.dto';
import { QueryMandantDto } from './dto/query-mandant.dto';
import { AddMandantWebsiteDto } from './dto/add-mandant-website.dto';
import { UpdateMandantModulesDto } from './dto/update-mandant-modules.dto';
import { RequirePermission } from '../auth/decorators/permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/strategies/jwt.strategy';
import { MasterOnlyGuard } from '../websites/master-only.guard';

// Mandantenfähigkeit für Master (Nutzervorgabe, 2026-08-27) – gleiches
// Rechte-/Guard-Muster wie die bestehende Websites-Verwaltung: Pivot-
// exklusiv über `settings:*`, zusätzlich hart auf `MasterOnlyGuard`
// (404 statt 403 auf einer Client-Installation).
@ApiTags('mandanten')
@ApiBearerAuth()
@UseGuards(MasterOnlyGuard)
@Controller('mandanten')
export class MandantenController {
  constructor(private readonly mandantenService: MandantenService) {}

  @RequirePermission('settings:read')
  @Get()
  findAll(@Query() query: QueryMandantDto) {
    return this.mandantenService.findAll(query);
  }

  @RequirePermission('settings:read')
  @Get('stats')
  getStats() {
    return this.mandantenService.getStats();
  }

  // Muss vor `@Get(':id')` stehen, sonst würde "modules" als `:id`
  // interpretiert.
  @RequirePermission('settings:read')
  @Get('modules')
  getModuleCatalog() {
    return this.mandantenService.getModuleCatalog();
  }

  @RequirePermission('settings:read')
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.mandantenService.findOne(id);
  }

  @RequirePermission('settings:update')
  @Post()
  create(@Body() dto: CreateMandantDto) {
    return this.mandantenService.create(dto);
  }

  @RequirePermission('settings:update')
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateMandantDto) {
    return this.mandantenService.update(id, dto);
  }

  @RequirePermission('settings:update')
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.mandantenService.remove(id);
  }

  @RequirePermission('settings:update')
  @Post(':id/websites')
  addWebsite(@Param('id') id: string, @Body() dto: AddMandantWebsiteDto) {
    return this.mandantenService.addWebsite(id, dto);
  }

  @RequirePermission('settings:update')
  @Patch(':id/modules')
  updateModules(
    @Param('id') id: string,
    @Body() dto: UpdateMandantModulesDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.mandantenService.updateModules(id, dto.moduleKeys, user.sub);
  }
}
