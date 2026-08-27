import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { timingSafeEqual } from 'node:crypto';
import { LicenseClientService } from './license-client.service';
import { LicenseRecoveryVerifyDto } from './dto/license-recovery-verify.dto';
import { LicenseRecoveryApplyKeyDto } from './dto/license-recovery-apply-key.dto';
import { Public } from '../auth/decorators/public.decorator';
import { RequirePermission } from '../auth/decorators/permissions.decorator';
import { getAppVersion } from '../common/utils/app-version';

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
   * naturgemäß.
   *
   * Update 2026-08-24, Nutzer-Bugreport ("Key erneuert, dann bei strasev
   * ohne was anzupassen geprüft, und alles in Ordnung?????"): liefert jetzt
   * zusätzlich `lastCheck` mit dem ECHTEN Ergebnis des gerade eben
   * durchgeführten Versuchs – vorher gab dieser Endpunkt bei einem
   * fehlgeschlagenen Versuch (z.B. falscher/veralteter Key) trotzdem
   * kommentarlos den alten, zwischengespeicherten Status zurück. */
  @RequirePermission('settings:update')
  @Post('recheck')
  async recheck() {
    const before = await this.licenseClient.getEffectiveStatus();
    if (before.mode === 'master') return before;
    const lastCheck = await this.licenseClient.performCheck();
    const status = await this.licenseClient.getEffectiveStatus();
    return { ...status, lastCheck };
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
   * ohnehin schon zwischen Master und dieser Installation geteilten Key
   * abgesichert statt eines neuen Secrets – über `getApiKey()` (nicht mehr
   * nur die Umgebungsvariable), sonst würde ein über die neue
   * Master-Client-UI gesetzter Key eingehende Weck-Aufrufe fälschlich
   * ablehnen. Steht auch in `LicenseEnforcementGuard`s Ausnahmeliste, damit
   * eine gesperrte Installation überhaupt geweckt werden kann. Gibt das
   * echte Prüfungsergebnis zurück (siehe `recheck()`-Kommentar), damit der
   * Master beim Wecken erkennt, ob der Key beim Client noch stimmt. */
  @Public()
  @Post('wakeup')
  async wakeup(@Headers('authorization') authorization?: string) {
    const expected = await this.licenseClient.getApiKey();
    const provided = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
    const expectedBuf = Buffer.from(expected ?? '', 'utf8');
    const providedBuf = Buffer.from(provided ?? '', 'utf8');
    const isValid =
      !!expected &&
      !!provided &&
      expectedBuf.length === providedBuf.length &&
      timingSafeEqual(expectedBuf, providedBuf);
    if (!isValid) {
      await this.licenseClient.recordFailedWakeupAttempt();
      throw new UnauthorizedException('Ungültiger Weck-Schlüssel.');
    }
    const outcome = await this.licenseClient.requestWakeup();
    // Nutzervorgabe, 2026-08-25: "Versionierung ... soll beim Prüfen
    // eingeholt werden, so dass man den aktuellen Stand ermitteln kann" –
    // der Master liest das aus der Wecken-Antwort (WebsitesService.
    // performWakeup()) und persistiert es auf Website.lastReportedVersion.
    return { triggered: true, outcome, version: getAppVersion() };
  }

  /** Schritt 1 des Wiederherstellungs-Popups auf der Wartungsseite
   * (Nutzervorgabe, 2026-08-26): eine gesperrte Installation blockt sonst
   * auch den Login selbst – ohne diesen Weg gäbe es keine Möglichkeit mehr,
   * einen falsch eingetragenen Lizenz-Key zu korrigieren. Bewusst `@Public`
   * (kein Login nötig, genau das wäre ja gesperrt) UND in
   * `LicenseEnforcementGuard`s Ausnahmeliste, aber trotzdem durch echte
   * Zugangsdaten + `settings:update`-Recht abgesichert (siehe Service).
   * Gleiches Rate-Limit wie der normale Login (Brute-Force-Schutz). */
  @Public()
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('recovery/verify')
  async recoveryVerify(@Body() dto: LicenseRecoveryVerifyDto) {
    const recoveryToken = await this.licenseClient.verifyRecoveryCredentials(
      dto.email,
      dto.password,
    );
    return { recoveryToken };
  }

  /** Schritt 2: nimmt das Token aus Schritt 1 plus den korrigierten Key
   * entgegen, speichert ihn und löst sofort einen echten Re-Check aus.
   * Eigenes Rate-Limit (Sicherheits-Review, 2026-08-27): ohne das ließe
   * sich innerhalb der 5-Minuten-Gültigkeit eines echten Tokens beliebig
   * oft ein Key raten. */
  @Public()
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('recovery/apply-key')
  async recoveryApplyKey(@Body() dto: LicenseRecoveryApplyKeyDto) {
    return this.licenseClient.applyRecoveryKey(dto.recoveryToken, dto.apiKey);
  }
}
