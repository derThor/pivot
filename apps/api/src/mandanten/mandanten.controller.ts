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
import { AddMandantModuleDto } from './dto/add-mandant-module.dto';
import { UpdateMandantModuleDto } from './dto/update-mandant-module.dto';
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
  @Post(':id/modules')
  addModule(
    @Param('id') id: string,
    @Body() dto: AddMandantModuleDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.mandantenService.addModule(id, dto.moduleKey, user.sub);
  }

  @RequirePermission('settings:update')
  @Patch(':id/modules/:moduleKey')
  setModuleEnabled(
    @Param('id') id: string,
    @Param('moduleKey') moduleKey: string,
    @Body() dto: UpdateMandantModuleDto,
  ) {
    return this.mandantenService.setModuleEnabled(id, moduleKey, dto.enabled);
  }

  @RequirePermission('settings:update')
  @Delete(':id/modules/:moduleKey')
  removeModule(@Param('id') id: string, @Param('moduleKey') moduleKey: string) {
    return this.mandantenService.removeModule(id, moduleKey);
  }

  @RequirePermission('settings:update')
  @Patch(':id/modules/:moduleKey/features/:featureKey')
  setModuleFeatureEnabled(
    @Param('id') id: string,
    @Param('moduleKey') moduleKey: string,
    @Param('featureKey') featureKey: string,
    @Body() dto: UpdateMandantModuleDto,
  ) {
    return this.mandantenService.setModuleFeatureEnabled(
      id,
      moduleKey,
      featureKey,
      dto.enabled,
    );
  }
}
