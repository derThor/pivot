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

  /** "Auskunft senden" (Betroffenenrechte-Kachel, Art. 15 DSGVO,
   * Nutzervorgabe 2026-08-19) – nutzt die im Konto hinterlegte E-Mail-
   * Adresse, kein separates Empfänger-Feld. Wie alle System-Mails hier
   * nur ein Dev-Stub (kein SMTP angebunden). */
  async sendSubjectAccessReport(to: string, csv: string): Promise<void> {
    this.logger.log(
      `[Dev-Stub] Auskunft (Art. 15 DSGVO) an ${to} (${csv.split('\n').length - 1} Zeilen).`,
    );
  }

  /** Betroffenenanfragen-Log, Schalter "Eingang automatisch bestätigen"
   * (Nutzervorgabe, 2026-08-19): Mail an den Absender direkt beim Anlegen
   * einer neuen Anfrage. Dev-Stub wie jede Mail hier. */
  async sendDeletionRequestAcknowledgement(
    to: string,
    dsrId: string,
  ): Promise<void> {
    this.logger.log(
      `[Dev-Stub] Eingangsbestätigung für ${dsrId} an ${to}.`,
    );
  }

  /** Betroffenenanfragen-Log, Button "Rückfrage an Absender" – der Admin
   * formuliert die Rückfrage selbst im Popup (Nutzervorgabe, 2026-08-19),
   * kein fester Textbaustein mehr. */
  async sendDeletionRequestFollowUp(
    to: string,
    dsrId: string,
    message: string,
  ): Promise<void> {
    this.logger.log(`[Dev-Stub] Rückfrage zu ${dsrId} an ${to}: "${message}"`);
  }

  /** Betroffenenanfragen-Log, Schalter "Erinnerung 7 Tage vor Fristende"
   * (Nutzervorgabe, 2026-08-19) – Mail an den Datenschutzbeauftragten,
   * nicht an den Absender, damit intern rechtzeitig reagiert wird. */
  async sendDeletionRequestDeadlineReminder(
    to: string,
    dsrId: string,
    dueAt: Date,
  ): Promise<void> {
    this.logger.log(
      `[Dev-Stub] Fristerinnerung für ${dsrId} (fällig ${dueAt.toISOString()}) an ${to}.`,
    );
  }

  /** Auftragsverarbeiter-Tab, Karte "Offene Punkte", Button "AV-Vertrag
   * anfordern" (Nutzervorgabe, 2026-08-20). */
  async sendDataProcessorContractRequest(
    to: string,
    processorName: string,
  ): Promise<void> {
    this.logger.log(
      `[Dev-Stub] AV-Vertrag-Anfrage für "${processorName}" an ${to}.`,
    );
  }
}
