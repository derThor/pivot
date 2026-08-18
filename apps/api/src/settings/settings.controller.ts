import {
  Body,
  Controller,
  forwardRef,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { SettingsService } from './settings.service';
import { UpdateSettingsDto } from './dto/update-settings.dto';
import { RequirePermission } from '../auth/decorators/permissions.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CacheService } from '../cache/cache.service';
import { AuthService } from '../auth/auth.service';
import type { JwtPayload } from '../auth/strategies/jwt.strategy';

@ApiTags('settings')
@Controller('settings')
export class SettingsController {
  constructor(
    private readonly settingsService: SettingsService,
    private readonly cache: CacheService,
    @Inject(forwardRef(() => AuthService))
    private readonly authService: AuthService,
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
  update(@Body() dto: UpdateSettingsDto, @CurrentUser() user: JwtPayload) {
    return this.settingsService.update(dto, user.sub);
  }

  // "Letzte Änderungen" auf der Firma-Seite (Verwaltung → Firma).
  @ApiBearerAuth()
  @RequirePermission('settings:read')
  @Get('company/changes')
  getCompanyChanges() {
    return this.settingsService.getCompanyChanges();
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

  // Globale Aktionen im "Sicherheit"-Tab (Nutzervorgabe, 2026-08-17) –
  // gleiche Berechtigung wie "Cache leeren", da beide von derselben Seite
  // ausgelöst werden.
  @ApiBearerAuth()
  @RequirePermission('settings:update')
  @HttpCode(HttpStatus.OK)
  @Post('revoke-all-sessions')
  revokeAllSessions(@CurrentUser() user: JwtPayload) {
    return this.authService.revokeAllSessionsGlobally(user.sub);
  }

  @ApiBearerAuth()
  @RequirePermission('settings:update')
  @HttpCode(HttpStatus.OK)
  @Post('force-password-reset-all')
  forcePasswordResetAll(@CurrentUser() user: JwtPayload) {
    return this.authService.forcePasswordResetForAllUsers(user.sub);
  }
}
