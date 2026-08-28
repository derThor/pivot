import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ModuleSettingsService } from './module-settings.service';
import { UpdateModuleSettingsDto } from './dto/update-module-settings.dto';
import { UpdateModuleFeatureDto } from './dto/update-module-feature.dto';
import { RequirePermission } from '../auth/decorators/permissions.decorator';
import { MasterOnlyGuard } from '../websites/master-only.guard';

// Datenschutz-als-Modul (Nutzervorgabe, 2026-08-28): "für den Master sind
// die Einstellungen für Module unter Einstellungen zu setzen" – Masters
// eigene Modul-/Feature-Freischaltung, komplett getrennt vom Mandanten-
// Buchungssystem (`MandantenController`). Gleiches Guard-/Rechte-Muster:
// `MasterOnlyGuard` (404 statt 403 auf einer Client-Installation),
// `settings:read`/`settings:update`.
@ApiTags('module-settings')
@ApiBearerAuth()
@UseGuards(MasterOnlyGuard)
@Controller('module-settings')
export class ModuleSettingsController {
  constructor(private readonly moduleSettingsService: ModuleSettingsService) {}

  @RequirePermission('settings:read')
  @Get()
  findAll() {
    return this.moduleSettingsService.findAll();
  }

  @RequirePermission('settings:update')
  @Patch(':key')
  update(@Param('key') key: string, @Body() dto: UpdateModuleSettingsDto) {
    return this.moduleSettingsService.update(key, dto);
  }

  @RequirePermission('settings:update')
  @Patch(':key/features/:featureKey')
  setFeatureEnabled(
    @Param('key') key: string,
    @Param('featureKey') featureKey: string,
    @Body() dto: UpdateModuleFeatureDto,
  ) {
    return this.moduleSettingsService.setFeatureEnabled(
      key,
      featureKey,
      dto.enabled,
    );
  }
}
