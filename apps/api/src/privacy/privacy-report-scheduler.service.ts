import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { SettingsService } from '../settings/settings.service';
import { MailerService } from '../mailer/mailer.service';
import { PrivacyService } from './privacy.service';

/**
 * Datenschutzbeauftragter-Tab, Schalter "Monatsbericht per E-Mail"
 * (Nutzervorgabe, 2026-08-18) – nutzt denselben CSV-Generator wie der
 * manuelle "Bericht erzeugen"-Button, läuft am Monatsersten früh morgens.
 * Gleiches Cron-Muster wie `ContentSchedulerService`.
 */
@Injectable()
export class PrivacyReportSchedulerService {
  private readonly logger = new Logger(PrivacyReportSchedulerService.name);

  constructor(
    private readonly settings: SettingsService,
    private readonly mailer: MailerService,
    private readonly privacyService: PrivacyService,
  ) {}

  @Cron(CronExpression.EVERY_1ST_DAY_OF_MONTH_AT_MIDNIGHT)
  async sendMonthlyReport() {
    const settings = await this.settings.get();
    if (!settings.dpoMonthlyReportEnabled || !settings.dpoEmail) return;

    const csv = await this.privacyService.generateReportCsv();
    await this.mailer.sendDpoMonthlyReport(settings.dpoEmail, csv);
    this.logger.log(`Monatsbericht an DSB ${settings.dpoEmail} gesendet.`);
  }
}
