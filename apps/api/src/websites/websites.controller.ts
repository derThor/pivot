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
import { WebsitesService } from './websites.service';
import { CreateWebsiteDto } from './dto/create-website.dto';
import { UpdateWebsiteDto } from './dto/update-website.dto';
import { QueryWebsiteDto } from './dto/query-website.dto';
import { RequirePermission } from '../auth/decorators/permissions.decorator';
import { getMasterPublicKeyBase64 } from './license-token.util';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/strategies/jwt.strategy';
import { MasterOnlyGuard } from './master-only.guard';
import { WebsiteMonitorService } from './website-monitor.service';

// Pivot-exklusiv über das bestehende `settings:*`-Muster (wie Mailing/
// Integrationen/Jobs) statt einer eigenen Rechte-Ressource – Nutzervorgabe,
// siehe knowledge-base/platform/master-slave-licensing.md. Zusätzlich
// `MasterOnlyGuard`: diese Endpunkte existieren nach außen nicht mehr
// (404), sobald die Installation nicht im Master-Modus läuft.
@ApiTags('websites')
@ApiBearerAuth()
@UseGuards(MasterOnlyGuard)
@Controller('websites')
export class WebsitesController {
  constructor(
    private readonly websitesService: WebsitesService,
    private readonly websiteMonitor: WebsiteMonitorService,
  ) {}

  @RequirePermission('settings:read')
  @Get()
  findAll(@Query() query: QueryWebsiteDto) {
    return this.websitesService.findAll(query);
  }

  // "Prüfen"-Button (Nutzervorgabe, 2026-08-24, zuletzt: "diese Prüfung
  // sagt nichts aus ... wenn ich prüfe, sollen alle Webseiten einmal
  // durchlaufen werden und den Status ausgeben, der gerade ist") – löst
  // zwei unabhängige Dinge sofort aus statt auf den nächsten Cron-Lauf zu
  // warten: den Live-Check gesperrter Websites (Anomalie-Erkennung) UND das
  // Wecken JEDER Website (echter Key-/Erreichbarkeits-Status pro
  // Installation, siehe WebsitesService.checkAllWebsites()).
  @RequirePermission('settings:update')
  @Post('check-now')
  async checkNow() {
    const [, wakeup] = await Promise.all([
      this.websiteMonitor.checkLockedWebsites(),
      this.websitesService.checkAllWebsites(),
    ]);
    return wakeup;
  }

  // Muss vor `@Get(':id')`-artigen Routen stehen, falls je eine hinzukommt
  // – aktuell gibt es keine Kollision, da nur `findAll()` auf `GET /`
  // liegt.
  @RequirePermission('settings:read')
  @Get('public-key')
  getPublicKey() {
    return { publicKey: getMasterPublicKeyBase64() };
  }

  @RequirePermission('settings:update')
  @Post()
  create(@Body() dto: CreateWebsiteDto) {
    return this.websitesService.create(dto);
  }

  @RequirePermission('settings:update')
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateWebsiteDto) {
    return this.websitesService.update(id, dto);
  }

  // Zählerstände app-weit zurücksetzen (Nutzervorgabe, 2026-09-01: "der
  // zählerstand muss zurücksetzbar sein"). MUSS vor `@Delete(':id')`
  // stehen: Nest prüft die Routen in Deklarationsreihenfolge, sonst würde
  // "stats-history" als Website-ID gelesen und der Aufruf liefe ins
  // Löschen einer Website.
  @RequirePermission('settings:update')
  @Delete('stats-history')
  resetStatsHistory(@CurrentUser() user: JwtPayload) {
    return this.websitesService.resetStatsHistory(user.sub);
  }

  @RequirePermission('settings:update')
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.websitesService.remove(id);
  }

  @RequirePermission('settings:update')
  @Post(':id/regenerate-key')
  regenerateApiKey(@Param('id') id: string) {
    return this.websitesService.regenerateApiKey(id);
  }

  @RequirePermission('settings:read')
  @Get(':id/api-key')
  revealApiKey(@Param('id') id: string) {
    return this.websitesService.revealApiKey(id);
  }

  // "Wecken" (Nutzervorgabe, 2026-08-24: "können wir das auch einbauen") –
  // löst bei der Client-Installation ihren eigenen, selbst-signierten
  // Pull-Check sofort aus, statt auf den wöchentlichen Cron zu warten.
  // Setzt hier nie selbst einen Status, siehe WebsitesService.wakeup().
  @RequirePermission('settings:update')
  @Post(':id/wakeup')
  wakeup(@Param('id') id: string) {
    return this.websitesService.wakeup(id);
  }

  // "Zur Kenntnis genommen" für die Plausibilitäts-Anomalie (Nutzervorgabe,
  // 2026-09-01) – bewusst eine ausdrückliche Handlung, siehe
  // WebsitesService.dismissStatsAnomaly(). Gleiches Recht wie das Prüfen
  // selbst.
  // Zählerstand nur dieser einen Website zurücksetzen (Nutzervorgabe,
  // 2026-09-01). Kollidiert nicht mit `@Delete(':id')`: zwei Segmente
  // statt einem.
  @RequirePermission('settings:update')
  @Delete(':id/stats-history')
  resetWebsiteStatsHistory(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.websitesService.resetStatsHistory(user.sub, id);
  }

  @RequirePermission('settings:update')
  @Post(':id/dismiss-stats-anomaly')
  dismissStatsAnomaly(@Param('id') id: string) {
    return this.websitesService.dismissStatsAnomaly(id);
  }
}
