import {
  Body,
  Controller,
  Headers,
  Post,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { WebsitesService } from './websites.service';
import { LicenseCheckDto } from './dto/license-check.dto';
import { Public } from '../auth/decorators/public.decorator';
import { MasterOnlyGuard } from './master-only.guard';

/**
 * Öffentlicher Pull-Endpunkt: eine Slave-Installation ruft hier wöchentlich
 * ab, ob sie noch aktiv sein darf (siehe
 * knowledge-base/platform/master-slave-licensing.md – Pull statt Push,
 * damit der Master keine Kunden-Domain erreichbar machen muss). Auth über
 * einen Site-eigenen API-Key (`Authorization: Bearer <key>`), nicht über
 * den normalen JWT-Login – hier meldet sich kein Mensch an, sondern eine
 * unbeaufsichtigte Slave-Installation. Der globale `ThrottlerGuard`
 * (app.module.ts) deckt Rate-Limiting bereits ab. `MasterOnlyGuard` läuft
 * trotz `@Public()` weiterhin (unabhängiges Anliegen: kein JWT nötig, aber
 * nur eine echte Master-Installation darf Tokens ausstellen).
 */
@ApiTags('license')
@UseGuards(MasterOnlyGuard)
@Controller('license')
export class LicenseController {
  constructor(private readonly websitesService: WebsitesService) {}

  @Public()
  @Post('check')
  checkLicense(
    @Body() dto: LicenseCheckDto,
    @Headers('authorization') authorization?: string,
  ) {
    const apiKey = authorization?.startsWith('Bearer ')
      ? authorization.slice('Bearer '.length)
      : null;
    if (!apiKey) {
      throw new UnauthorizedException('Ungültige Zugangsdaten.');
    }
    return this.websitesService.checkLicense(dto.domain, apiKey);
  }
}
