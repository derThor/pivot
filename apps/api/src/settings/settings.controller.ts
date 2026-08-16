import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { SettingsService } from './settings.service';
import { UpdateSettingsDto } from './dto/update-settings.dto';
import { RequirePermission } from '../auth/decorators/permissions.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { CacheService } from '../cache/cache.service';

@ApiTags('settings')
@Controller('settings')
export class SettingsController {
  constructor(
    private readonly settingsService: SettingsService,
    private readonly cache: CacheService,
  ) {}

  @ApiBearerAuth()
  @RequirePermission('settings:read')
  @Get()
  get() {
    return this.settingsService.get();
  }

  @Public()
  @Get('public')
  getPublic() {
    return this.settingsService.getPublic();
  }

  @ApiBearerAuth()
  @RequirePermission('settings:update')
  @Patch()
  update(@Body() dto: UpdateSettingsDto) {
    return this.settingsService.update(dto);
  }

  // "Cache leeren" unter Einstellungen (Nutzervorgabe, 2026-08-16) – leert
  // den gesamten `CacheService`, nicht nur einen Teilbereich, da der Cache
  // app-weit gemeinsam genutzt wird (siehe cache/cache.service.ts).
  @ApiBearerAuth()
  @RequirePermission('settings:update')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Post('clear-cache')
  clearCache() {
    this.cache.clear();
  }
}
