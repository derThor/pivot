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

  // "Prüfen"-Button (Einstellungen → Master-Client, Nutzervorgabe,
  // 2026-08-24) – löst den sonst alle 30 Minuten laufenden Live-Check
  // sofort aus, statt auf den nächsten Cron-Lauf zu warten.
  @RequirePermission('settings:update')
  @Post('check-now')
  async checkNow() {
    await this.websiteMonitor.checkLockedWebsites();
    return { checkedAt: new Date().toISOString() };
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
}
