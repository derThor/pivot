import {
  Controller,
  Get,
  Headers,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { timingSafeEqual } from 'node:crypto';
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
  constructor(
    private readonly licenseClient: LicenseClientService,
    private readonly config: ConfigService,
  ) {}

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

  /** Nutzervorgabe, 2026-08-24: "können wir das auch einbauen" – der Master
   * darf eine Client-Installation "aufwecken", ohne das Pull-Prinzip zu
   * brechen: dieser Aufruf löst nur denselben `performCheck()` aus, den die
   * Installation auch selbst anstoßen würde. Der tatsächliche Lizenzstatus
   * kommt weiterhin ausschließlich aus der eigenen, signierten Rückfrage
   * bei `LICENSE_MASTER_URL` – wer auch immer diesen Endpunkt aufruft, kann
   * höchstens eine zusätzliche (harmlose) Prüfung erzwingen, nie einen
   * Status vorschreiben. Bewusst `@Public()` (kein Dashboard-Login – der
   * Master ist kein eingeloggter Nutzer) und per Bearer-Vergleich gegen den
   * ohnehin schon zwischen Master und dieser Installation geteilten
   * `LICENSE_API_KEY` abgesichert statt eines neuen Secrets. Steht auch in
   * `LicenseEnforcementGuard`s Ausnahmeliste, damit eine gesperrte
   * Installation überhaupt geweckt werden kann. */
  @Public()
  @Post('wakeup')
  async wakeup(@Headers('authorization') authorization?: string) {
    const expected = this.config.get<string>('LICENSE_API_KEY');
    const provided = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
    const expectedBuf = Buffer.from(expected ?? '', 'utf8');
    const providedBuf = Buffer.from(provided ?? '', 'utf8');
    const isValid =
      !!expected &&
      !!provided &&
      expectedBuf.length === providedBuf.length &&
      timingSafeEqual(expectedBuf, providedBuf);
    if (!isValid) {
      throw new UnauthorizedException('Ungültiger Weck-Schlüssel.');
    }
    // Entprellt (siehe requestWakeup()) – schützt zusätzlich zum globalen
    // ThrottlerGuard davor, dass derselbe gültige Key über mehrere IPs
    // verteilt wiederholt echte Master-Anfragen auslöst.
    await this.licenseClient.requestWakeup();
    return { triggered: true };
  }
}
