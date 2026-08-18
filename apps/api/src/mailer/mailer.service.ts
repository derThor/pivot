import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class MailerService {
  private readonly logger = new Logger(MailerService.name);

  async sendVerificationEmail(to: string, link: string): Promise<void> {
    this.logger.log(`[Dev-Stub] Verifikations-Mail an ${to}: ${link}`);
  }

  async sendPasswordResetEmail(to: string, link: string): Promise<void> {
    this.logger.log(`[Dev-Stub] Passwort-Reset-Mail an ${to}: ${link}`);
  }

  /** Datenschutzbeauftragter-Tab, Schalter "Bei jedem Vorfall automatisch
   * benachrichtigen" (Nutzervorgabe, 2026-08-18). Dev-Stub wie alle
   * System-Mails in dieser App – kein SMTP angebunden. */
  async sendDpoIncidentNotification(
    to: string,
    incident: { title: string; severity: string },
  ): Promise<void> {
    this.logger.log(
      `[Dev-Stub] Vorfall-Benachrichtigung an DSB ${to}: „${incident.title}“ (Schweregrad: ${incident.severity})`,
    );
  }

  /** Datenschutzbeauftragter-Tab, Schalter "Monatsbericht per E-Mail" –
   * ausgelöst vom Cron in PrivacyReportSchedulerService. */
  async sendDpoMonthlyReport(to: string, csv: string): Promise<void> {
    this.logger.log(
      `[Dev-Stub] Monatsbericht an DSB ${to} (${csv.split('\n').length - 1} Kennzahlen).`,
    );
  }
}
