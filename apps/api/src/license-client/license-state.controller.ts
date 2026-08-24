import { Controller, Get, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { LicenseClientService } from './license-client.service';
import { Public } from '../auth/decorators/public.decorator';
import { RequirePermission } from '../auth/decorators/permissions.decorator';

/**
 * Öffentlicher, unauthentifizierter Status-Endpunkt (kein `MasterOnlyGuard`
 * – im Gegenteil, gerade auf einer Slave-Installation relevant): das
 * Next.js-Frontend fragt hier ab, ob die öffentliche Wartungsseite bzw.
 * das Entwicklungsinstanz-Hinweisbanner angezeigt werden soll. Bleibt vom
 * `LicenseEnforcementGuard` selbst unangetastet erreichbar (siehe dessen
 * Allowlist), sonst könnte sich eine gesperrte Installation nie mehr
 * selbst erklären.
 */
@ApiTags('license')
@Controller('license')
export class LicenseStateController {
  constructor(private readonly licenseClient: LicenseClientService) {}

  @Public()
  @Get('state')
  getState() {
    return this.licenseClient.getEffectiveStatus();
  }

  /** Nutzervorgabe, 2026-08-24: "Jetzt prüfen"-Knopf für die Client-Seite
   * – bislang prüfte `LicenseClientService` nur einmalig beim allerersten
   * Start oder wöchentlich per Cron; ein Kunde, der gerade wieder
   * freigeschaltet wurde, hätte sonst bis zu eine Woche warten müssen, um
   * das selbst zu merken. Auf einer Master-Installation bewusst ein No-Op
   * (kein `performCheck()`-Aufruf) statt eine sinnlose `LicenseState`-Zeile
   * mit Fehlermeldung anzulegen – dort fehlen die `LICENSE_MASTER_*`-Werte
   * naturgemäß. */
  @RequirePermission('settings:update')
  @Post('recheck')
  async recheck() {
    const before = await this.licenseClient.getEffectiveStatus();
    if (before.mode === 'master') return before;
    await this.licenseClient.performCheck();
    return this.licenseClient.getEffectiveStatus();
  }
}
