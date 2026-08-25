import {
  Body,
  Controller,
  Delete,
  forwardRef,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { SettingsService } from './settings.service';
import { UpdateSettingsDto } from './dto/update-settings.dto';
import { UpdateMaintenancePageDto } from './dto/update-maintenance-page.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';
import { UpdatePrivacyDto } from './dto/update-privacy.dto';
import { QuerySettingsChangesDto } from './dto/query-settings-changes.dto';
import { UpdateSmtpSettingsDto } from './dto/update-smtp-settings.dto';
import { SendSmtpTestEmailDto } from './dto/send-smtp-test-email.dto';
import { UpdateLicenseClientSettingsDto } from './dto/update-license-client-settings.dto';
import { UpdateMailTemplateDto } from './dto/update-mail-template.dto';
import { MailerService } from '../mailer/mailer.service';
import { RequirePermission } from '../auth/decorators/permissions.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CacheService } from '../cache/cache.service';
import { AuthService } from '../auth/auth.service';
import type { JwtPayload } from '../auth/strategies/jwt.strategy';
import { getAppVersion } from '../common/utils/app-version';

@ApiTags('settings')
@Controller('settings')
export class SettingsController {
  constructor(
    private readonly settingsService: SettingsService,
    private readonly cache: CacheService,
    private readonly mailer: MailerService,
    @Inject(forwardRef(() => AuthService))
    private readonly authService: AuthService,
  ) {}

  // Nutzervorgabe, 2026-08-25: Version dieser Installation unter
  // Einstellungen → Master-Client anzeigen – `appVersion` ist kein
  // DB-Feld, deshalb hier statt in SettingsService.get() angereichert
  // (das bleibt der rohe AppSettings-Datensatz, u.a. für update()).
  @ApiBearerAuth()
  @RequirePermission('settings:read')
  @Get()
  async get() {
    const settings = await this.settingsService.get();
    return { ...settings, appVersion: getAppVersion() };
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

  // Eigene, schmale Route für Titel/Text der Wartungsseite (Nutzer-
  // Bugreport, 2026-08-25) – bewusst getrennt vom allgemeinen
  // `PATCH /settings`, weil nur diese Route in LicenseEnforcementGuard
  // auch im gesperrten Zustand einer Client-Installation erreichbar
  // bleibt (siehe dortiger Kommentar). Gleiches Recht wie der Rest der
  // allgemeinen Einstellungen, kein eigenes Recht.
  @ApiBearerAuth()
  @RequirePermission('settings:update')
  @Patch('maintenance-page')
  updateMaintenancePage(
    @Body() dto: UpdateMaintenancePageDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.settingsService.update(dto, user.sub);
  }

  // Firma-Stammdaten (Verwaltung → Firma) – eigenes Recht `company:*`,
  // getrennt von `settings:*` (Nutzervorgabe, 2026-08-21: "admin soll
  // aber firma sehen können", siehe UpdateCompanyDto/getCompany()).
  @ApiBearerAuth()
  @RequirePermission('company:read')
  @Get('company')
  getCompany() {
    return this.settingsService.getCompany();
  }

  @ApiBearerAuth()
  @RequirePermission('company:update')
  @Patch('company')
  updateCompany(
    @Body() dto: UpdateCompanyDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.settingsService.updateCompany(dto, user.sub);
  }

  // "Letzte Änderungen" auf der Firma-Seite (Verwaltung → Firma).
  @ApiBearerAuth()
  @RequirePermission('company:read')
  @Get('company/changes')
  getCompanyChanges() {
    return this.settingsService.getCompanyChanges();
  }

  // Datenschutz-Seite (Verwaltung → Datenschutz) – eigenes Recht
  // `privacy:*` statt `settings:*`, gleicher Grund wie bei `company:*`
  // (Nutzer-Bugreport, 2026-08-21: "warum habe ich als admin keine
  // datenschutz zugriffsrechte, obwohl die rolle vergeben ist").
  @ApiBearerAuth()
  @RequirePermission('privacy:read')
  @Get('privacy')
  getPrivacySettings() {
    return this.settingsService.getPrivacy();
  }

  @ApiBearerAuth()
  @RequirePermission('privacy:update')
  @Patch('privacy')
  updatePrivacySettings(
    @Body() dto: UpdatePrivacyDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.settingsService.updatePrivacy(dto, user.sub);
  }

  // "Protokoll"-Tab unter Einstellungen (Nutzervorgabe, 2026-08-22: "baue
  // protokolierung", 1:1 nach Bildvorlage "Letzte Änderungen an den
  // Einstellungen"). Gleiches Recht wie der Rest der allgemeinen
  // Einstellungen (`settings:read`, also Pivot-exklusiv) – anders als
  // Firma/Datenschutz kein eigenes Recht nötig, das Protokoll gehört zur
  // Einstellungen-Seite selbst.
  @ApiBearerAuth()
  @RequirePermission('settings:read')
  @Get('changes')
  getSettingsChanges(@Query() query: QuerySettingsChangesDto) {
    return this.settingsService.getSettingsChanges(query.page, query.pageSize);
  }

  // "Einstellungen als JSON" (Nutzervorgabe, 2026-08-22: "umsetzen").
  @ApiBearerAuth()
  @RequirePermission('settings:read')
  @Get('export')
  exportSettingsJson() {
    return this.settingsService.exportSettingsJson();
  }

  // CSV-Export der Protokoll-Historie (Nutzervorgabe, 2026-08-22: "füge
  // export hinzu"). Vor `changes/:id` in der Datei nicht relevant, da
  // beides statische bzw. eindeutig unterscheidbare Pfade sind.
  @ApiBearerAuth()
  @RequirePermission('settings:read')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header(
    'Content-Disposition',
    'attachment; filename="einstellungen-protokoll.csv"',
  )
  @Get('changes/export')
  exportSettingsChanges() {
    return this.settingsService.exportSettingsChangesCsv();
  }

  // "Alle löschen" (Nutzervorgabe, 2026-08-22: "mache bei letzte änderung
  // ... rechts alle löschen dazu") – vor `changes/:id` in der Datei, da
  // inhaltlich zusammengehörig; Reihenfolge ist Express/Nest gegenüber
  // unkritisch (unterschiedliche Pfadstruktur, kein Shadowing möglich).
  @ApiBearerAuth()
  @RequirePermission('settings:update')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete('changes')
  deleteAllSettingsChanges() {
    return this.settingsService.deleteAllSettingsChanges();
  }

  // Einzelnen Protokoll-Eintrag löschen (Nutzervorgabe, 2026-08-22: "das
  // soll man löschen können") – bewusst nicht revisionssicher.
  @ApiBearerAuth()
  @RequirePermission('settings:update')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete('changes/:id')
  deleteSettingsChange(@Param('id') id: string) {
    return this.settingsService.deleteSettingsChange(id);
  }

  // Einstellungen → Integrationen, Karte "Dienste" (Nutzervorgabe,
  // 2026-08-22: "email versand bauen ... als dienst", 1:1 nach
  // Bildvorlage "E-Mail-Versand (SMTP)"). Gleiches Recht wie der Rest der
  // allgemeinen Einstellungen (`settings:*`, Pivot-exklusiv wie
  // Webhooks) – kein eigenes Recht, da Nutzervorgabe.
  @ApiBearerAuth()
  @RequirePermission('settings:read')
  @Get('smtp')
  getSmtpSettings() {
    return this.settingsService.getSmtpSettings();
  }

  @ApiBearerAuth()
  @RequirePermission('settings:update')
  @Patch('smtp')
  updateSmtpSettings(
    @Body() dto: UpdateSmtpSettingsDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.settingsService.updateSmtpSettings(dto, user.sub);
  }

  // "Einrichten"-Dialog, Button "Testmail senden" – Zieladresse kommt aus
  // dem Dialog (Nutzer-Bugreport, 2026-08-22: "ich habe die testmail
  // versendet, bekomme sie nicht" – die Konto-Adresse des Pivot-Nutzers
  // ist nicht zwingend eine echte, vom Nutzer kontrollierte Adresse,
  // siehe knowledge-base). Unabhängig vom automatischen Verbindungstest
  // beim Speichern.
  @ApiBearerAuth()
  @RequirePermission('settings:update')
  @HttpCode(HttpStatus.OK)
  @Post('smtp/test-email')
  sendSmtpTestEmail(@Body() dto: SendSmtpTestEmailDto) {
    return this.mailer.sendTestEmail(dto.to);
  }

  // Einstellungen → Master-Client, Schlüssel-Icon bei "Diese Installation"
  // (Nutzervorgabe, 2026-08-24) – gleiches Recht wie der Rest der
  // allgemeinen Einstellungen, kein eigenes Recht.
  @ApiBearerAuth()
  @RequirePermission('settings:read')
  @Get('license-client')
  getLicenseClientSettings() {
    return this.settingsService.getLicenseClientSettings();
  }

  @ApiBearerAuth()
  @RequirePermission('settings:update')
  @Patch('license-client')
  updateLicenseClientSettings(
    @Body() dto: UpdateLicenseClientSettingsDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.settingsService.updateLicenseClientSettings(dto, user.sub);
  }

  // Mailing-Reiter (Nutzervorgabe, 2026-08-23: "unter mailing möchte ich
  // die dazugehörenden mailvorlagen ... bearbeiten können ... auch
  // systemmails ... mailing soll dann doch unter einstellungen kommen") –
  // gleiches Recht wie der Rest der allgemeinen Einstellungen
  // (Pivot-exklusiv), kein eigenes Recht.
  @ApiBearerAuth()
  @RequirePermission('settings:read')
  @Get('mail-templates')
  listMailTemplates() {
    return this.mailer.listMailTemplates();
  }

  @ApiBearerAuth()
  @RequirePermission('settings:update')
  @Patch('mail-templates/:id')
  updateMailTemplate(
    @Param('id') id: string,
    @Body() dto: UpdateMailTemplateDto,
  ) {
    return this.mailer.updateMailTemplate(id, dto);
  }

  // "Auf Standard zurücksetzen".
  @ApiBearerAuth()
  @RequirePermission('settings:update')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete('mail-templates/:id')
  resetMailTemplate(@Param('id') id: string) {
    return this.mailer.resetMailTemplate(id);
  }

  @ApiBearerAuth()
  @RequirePermission('settings:update')
  @HttpCode(HttpStatus.OK)
  @Post('mail-templates/:id/test')
  sendMailTemplateTest(
    @Param('id') id: string,
    @Body() dto: SendSmtpTestEmailDto,
  ) {
    return this.mailer.sendMailTemplateTest(id, dto.to);
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
