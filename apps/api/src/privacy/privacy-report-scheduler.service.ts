import { Injectable } from '@nestjs/common';
import { SettingsService } from '../settings/settings.service';
import { MailerService } from '../mailer/mailer.service';
import { PrivacyService } from './privacy.service';

/**
 * Datenschutzbeauftragter-Tab, Schalter "Monatsbericht per E-Mail"
 * (Nutzervorgabe, 2026-08-18) – nutzt denselben CSV-Generator wie der
 * manuelle "Bericht erzeugen"-Button. Läuft seit dem "Jobs"-Reiter
 * (Nutzervorgabe, 2026-08-22) nicht mehr über einen eigenen
 * `@Cron()`-Dekorator, sondern wird von `JobsService` dynamisch über
 * `SchedulerRegistry` getriggert (editierbarer Zeitplan) – die
 * Rückgabe ist ein kurzer Klartext-Status für den zugehörigen Job-Lauf.
 */
@Injectable()
export class PrivacyReportSchedulerService {
  constructor(
    private readonly settings: SettingsService,
    private readonly mailer: MailerService,
    private readonly privacyService: PrivacyService,
  ) {}

  async sendMonthlyReport(): Promise<string> {
    const settings = await this.settings.get();
    if (!settings.dpoMonthlyReportEnabled) {
      return 'Übersprungen: Automatik deaktiviert.';
    }
    if (!settings.dpoEmail) {
      return 'Übersprungen: kein DSB-Kontakt hinterlegt.';
    }

    const csv = await this.privacyService.generateReportCsv();
    await this.mailer.sendDpoMonthlyReport(settings.dpoEmail, csv);
    return `Monatsbericht an ${settings.dpoEmail} gesendet.`;
  }
}
