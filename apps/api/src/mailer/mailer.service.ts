import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import { PrismaService } from '../prisma/prisma.service';
import { decryptSecret } from '../common/utils/secret-encryption';

interface SmtpConfig {
  host: string;
  port: number;
  username: string | null;
  password: string | null;
  fromAddress: string | null;
  fromName: string | null;
  secure: string;
}

interface MailAttachment {
  filename: string;
  content: string;
  contentType: string;
}

/**
 * Verschickt echte Mails über SMTP, sobald unter Einstellungen →
 * Integrationen ein Dienst eingerichtet ist (Nutzervorgabe, 2026-08-22:
 * "email versand bauen ... die bestehenden system-mails sollen dann echt
 * verschickt werden"). Ohne Konfiguration (kein `smtpHost` gesetzt)
 * bleibt der bisherige Dev-Stub-Fallback aktiv – reiner Logger-Eintrag,
 * kein Absturz für Umgebungen ohne SMTP.
 */
@Injectable()
export class MailerService {
  private readonly logger = new Logger(MailerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  private get encryptionKey(): string {
    return this.config.getOrThrow<string>('TOTP_ENCRYPTION_KEY');
  }

  private async loadConfig(): Promise<SmtpConfig | null> {
    const settings = await this.prisma.appSettings.findUnique({
      where: { id: 1 },
      select: {
        smtpHost: true,
        smtpPort: true,
        smtpUsername: true,
        smtpPasswordEncrypted: true,
        smtpFromAddress: true,
        smtpFromName: true,
        smtpSecure: true,
      },
    });
    if (!settings?.smtpHost) return null;
    return {
      host: settings.smtpHost,
      port: settings.smtpPort ?? 587,
      username: settings.smtpUsername,
      password: settings.smtpPasswordEncrypted
        ? decryptSecret(settings.smtpPasswordEncrypted, this.encryptionKey)
        : null,
      fromAddress: settings.smtpFromAddress,
      fromName: settings.smtpFromName,
      secure: settings.smtpSecure,
    };
  }

  private buildTransport(cfg: SmtpConfig): Transporter {
    return nodemailer.createTransport({
      host: cfg.host,
      port: cfg.port,
      secure: cfg.secure === 'ssl',
      requireTLS: cfg.secure === 'starttls',
      auth: cfg.username
        ? { user: cfg.username, pass: cfg.password ?? undefined }
        : undefined,
    });
  }

  /** "Einrichten"-Dialog, Button "Verbindung testen" (nach dem Speichern
   * ausgelöst) – prüft die aktuell gespeicherte Konfiguration, ohne eine
   * Mail zu verschicken. */
  async testConnection(): Promise<{ ok: boolean; error?: string }> {
    const cfg = await this.loadConfig();
    if (!cfg) return { ok: false, error: 'Kein SMTP-Server hinterlegt.' };
    try {
      await this.buildTransport(cfg).verify();
      return { ok: true };
    } catch (err) {
      return { ok: false, error: (err as Error).message };
    }
  }

  /** "Einrichten"-Dialog, Button "Testmail senden" – verschickt eine
   * echte Mail an die eigene Konto-Adresse des Pivot-Nutzers. */
  async sendTestEmail(to: string): Promise<{ ok: boolean; error?: string }> {
    const cfg = await this.loadConfig();
    if (!cfg) return { ok: false, error: 'Kein SMTP-Server hinterlegt.' };
    try {
      await this.buildTransport(cfg).sendMail({
        from: this.formatFrom(cfg),
        to,
        subject: 'Test-Mail von Pivot',
        text: 'Diese Mail bestätigt, dass der E-Mail-Versand (SMTP) korrekt eingerichtet ist.',
      });
      return { ok: true };
    } catch (err) {
      return { ok: false, error: (err as Error).message };
    }
  }

  private formatFrom(cfg: SmtpConfig): string {
    const address = cfg.fromAddress ?? cfg.username ?? cfg.host;
    return cfg.fromName ? `"${cfg.fromName}" <${address}>` : address;
  }

  private async deliver(
    to: string,
    subject: string,
    text: string,
    attachments?: MailAttachment[],
  ): Promise<void> {
    const cfg = await this.loadConfig();
    if (!cfg) {
      this.logger.log(`[Dev-Stub] "${subject}" an ${to}: ${text}`);
      return;
    }
    try {
      await this.buildTransport(cfg).sendMail({
        from: this.formatFrom(cfg),
        to,
        subject,
        text,
        attachments,
      });
    } catch (err) {
      this.logger.error(
        `Mailversand an ${to} fehlgeschlagen ("${subject}"): ${(err as Error).message}`,
      );
    }
  }

  async sendVerificationEmail(to: string, link: string): Promise<void> {
    await this.deliver(
      to,
      'Bestätige deine E-Mail-Adresse',
      `Bitte bestätige deine E-Mail-Adresse über folgenden Link: ${link}`,
    );
  }

  async sendPasswordResetEmail(to: string, link: string): Promise<void> {
    await this.deliver(
      to,
      'Passwort zurücksetzen',
      `Setze dein Passwort über folgenden Link zurück: ${link}`,
    );
  }

  /** Datenschutzbeauftragter-Tab, Schalter "Bei jedem Vorfall automatisch
   * benachrichtigen" (Nutzervorgabe, 2026-08-18). */
  async sendDpoIncidentNotification(
    to: string,
    incident: { title: string; severity: string },
  ): Promise<void> {
    await this.deliver(
      to,
      `Neuer Datenschutzvorfall: ${incident.title}`,
      `Es wurde ein neuer Datenschutzvorfall erfasst: „${incident.title}“ (Schweregrad: ${incident.severity}).`,
    );
  }

  /** Datenschutzbeauftragter-Tab, Schalter "Monatsbericht per E-Mail" –
   * ausgelöst vom Cron in PrivacyReportSchedulerService. */
  async sendDpoMonthlyReport(to: string, csv: string): Promise<void> {
    const rows = csv.split('\n').length - 1;
    await this.deliver(
      to,
      'Monatsbericht Datenschutz',
      `Im Anhang findest du den aktuellen Datenschutz-Monatsbericht (${rows} Kennzahlen).`,
      [
        {
          filename: 'monatsbericht.csv',
          content: csv,
          contentType: 'text/csv; charset=utf-8',
        },
      ],
    );
  }

  /** "Auskunft senden" (Betroffenenrechte-Kachel, Art. 15 DSGVO,
   * Nutzervorgabe 2026-08-19) – nutzt die im Konto hinterlegte E-Mail-
   * Adresse, kein separates Empfänger-Feld. */
  async sendSubjectAccessReport(to: string, csv: string): Promise<void> {
    const rows = csv.split('\n').length - 1;
    await this.deliver(
      to,
      'Ihre Auskunft nach Art. 15 DSGVO',
      `Im Anhang finden Sie Ihre Auskunft nach Art. 15 DSGVO (${rows} Zeilen).`,
      [
        {
          filename: 'auskunft.csv',
          content: csv,
          contentType: 'text/csv; charset=utf-8',
        },
      ],
    );
  }

  /** Betroffenenanfragen-Log, Schalter "Eingang automatisch bestätigen"
   * (Nutzervorgabe, 2026-08-19): Mail an den Absender direkt beim Anlegen
   * einer neuen Anfrage. */
  async sendDeletionRequestAcknowledgement(
    to: string,
    dsrId: string,
  ): Promise<void> {
    await this.deliver(
      to,
      'Eingang Ihrer Anfrage bestätigt',
      `Wir haben Ihre Anfrage (${dsrId}) erhalten und bearbeiten sie zeitnah.`,
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
    await this.deliver(to, `Rückfrage zu Ihrer Anfrage (${dsrId})`, message);
  }

  /** Betroffenenanfragen-Log, Schalter "Erinnerung 7 Tage vor Fristende"
   * (Nutzervorgabe, 2026-08-19) – Mail an den Datenschutzbeauftragten,
   * nicht an den Absender, damit intern rechtzeitig reagiert wird. */
  async sendDeletionRequestDeadlineReminder(
    to: string,
    dsrId: string,
    dueAt: Date,
  ): Promise<void> {
    await this.deliver(
      to,
      `Frist läuft bald ab: Anfrage ${dsrId}`,
      `Die Frist für die Anfrage ${dsrId} läuft am ${dueAt.toLocaleDateString('de-DE')} ab.`,
    );
  }

  /** Auftragsverarbeiter-Tab, Karte "Offene Punkte", Button "AV-Vertrag
   * anfordern" (Nutzervorgabe, 2026-08-20). */
  async sendDataProcessorContractRequest(
    to: string,
    processorName: string,
  ): Promise<void> {
    await this.deliver(
      to,
      'Anfrage AV-Vertrag',
      `Wir bitten um Zusendung des Auftragsverarbeitungsvertrags für "${processorName}".`,
    );
  }

  /** Systembenachrichtigungen (Wartungsmodus, Speicherplatz, Webhooks
   * usw.) an die gemeinsame Empfänger-Adresse (Nutzervorgabe, 2026-08-22:
   * "wie stelle ich ein, dass die benachrichtigungen an eine bestimmte
   * email gesendet werden" – "sofort bei jedem neuen Vorfall"). Aufrufer
   * ist NotificationsService.sync(), das per NotificationEmailLog dafür
   * sorgt, dass pro `dedupeKey` nur einmal gemailt wird, unabhängig davon,
   * welcher Nutzer den auslösenden Sync-Lauf ausführt. */
  async sendSystemNotificationEmail(
    to: string,
    notification: {
      title: string;
      description: string;
      actionLabel: string | null;
      actionUrl: string | null;
    },
  ): Promise<void> {
    const link = notification.actionUrl
      ? `${this.frontendOrigin()}${notification.actionUrl}`
      : null;
    const text = [
      notification.description,
      link ? `${notification.actionLabel ?? 'Öffnen'}: ${link}` : null,
    ]
      .filter(Boolean)
      .join('\n\n');
    await this.deliver(to, notification.title, text);
  }

  private frontendOrigin(): string {
    return this.config.get<string>('CORS_ORIGIN', 'http://localhost:3000');
  }
}
