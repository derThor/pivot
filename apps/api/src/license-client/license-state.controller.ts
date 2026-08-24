import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { LicenseClientService } from './license-client.service';
import { Public } from '../auth/decorators/public.decorator';

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
}
