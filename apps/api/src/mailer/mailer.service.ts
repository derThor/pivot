import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import juice from 'juice';
import { PrismaService } from '../prisma/prisma.service';
import { decryptSecret } from '../common/utils/secret-encryption';
import {
  SYSTEM_MAIL_TEMPLATES,
  defaultFormTemplate,
  formFieldPlaceholders,
  formFieldLabels,
  hasShellContentPlaceholder,
  MAIL_SHELL_CONTENT_PLACEHOLDER,
  type FormMailKind,
  type MailTemplateCategory,
} from './mail-templates.catalog';

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

interface RenderedMail {
  subject: string;
  text: string;
  html: string;
}

export interface MailTemplateListItem {
  id: string;
  category: MailTemplateCategory;
  label: string;
  subject: string;
  body: string;
  enabled: boolean;
  recipientTo: string | null;
  recipientEditable: boolean;
  placeholders: string[];
  // Nur bei formulargebundenen Vorlagen gesetzt – Feld-Id → echtes
  // Feld-Label aus dem Formular-Builder, für die Platzhalter-Tooltips.
  placeholderLabels?: Record<string, string>;
  isCustomized: boolean;
  formId: string | null;
  // Welche Hülle beim Versand verwendet wird – `null` = Standard-Hülle
  // der Installation (siehe MailerService.wrapInShell).
  shellId: string | null;
}

export interface UpdateMailTemplateInput {
  subject?: string;
  body?: string;
  shellId?: string | null;
  enabled?: boolean;
  recipientTo?: string | null;
}

export interface MailShellListItem {
  id: string;
  name: string;
  content: string;
  isDefault: boolean;
  updatedAt: Date;
  usedByCount: number;
}

export interface CreateMailShellInput {
  name: string;
}

export interface UpdateMailShellInput {
  name?: string;
  content?: string;
  isDefault?: boolean;
}

/**
 * Verschickt echte Mails über SMTP, sobald unter Einstellungen →
 * Integrationen ein Dienst eingerichtet ist. Ohne Konfiguration (kein
 * `smtpHost` gesetzt) bleibt der Dev-Stub-Fallback aktiv – reiner
 * Logger-Eintrag, kein Absturz für Umgebungen ohne SMTP.
 *
 * Seit 2026-08-23 (Formulare + Mailing) sind alle festen System-Mail-Texte
 * über `MailTemplate` anpassbar (siehe mail-templates.catalog.ts) – ohne
 * eigene DB-Zeile liefert `renderSystemTemplate()` exakt den bisherigen
 * Standardtext zurück.
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

  /** Fußzeile aus den echten Firma-Stammdaten (Verwaltung → Firma) –
   * bewusst zentral hier statt pro Vorlage dupliziert. Ohne hinterlegten
   * Firmennamen bleibt die Mail unverändert (kein erfundener Platzhalter-
   * text). */
  private async appendFooter(text: string): Promise<string> {
    const settings = await this.prisma.appSettings.findUnique({
      where: { id: 1 },
      select: {
        companyName: true,
        companyStreet: true,
        companyPostalCode: true,
        companyCity: true,
        companyEmail: true,
        companyPhone: true,
      },
    });
    if (!settings?.companyName) return text;
    const addressLine = [
      settings.companyStreet,
      [settings.companyPostalCode, settings.companyCity]
        .filter(Boolean)
        .join(' '),
    ]
      .filter(Boolean)
      .join(', ');
    const contactLine = [settings.companyEmail, settings.companyPhone]
      .filter(Boolean)
      .join(' · ');
    const footer = [settings.companyName, addressLine, contactLine]
      .filter(Boolean)
      .join('\n');
    return `${text}\n\n---\n${footer}`;
  }

  // Gibt bewusst `{ok, error}` statt zu werfen zurück (gleiches Muster wie
  // `sendTestEmail()`) – ein fehlgeschlagener automatischer Versand (z.B.
  // Passwort-Reset) darf den auslösenden Request nicht zum Absturz
  // bringen, wird aber trotzdem geloggt. `sendMailTemplateTest()` gibt das
  // Ergebnis zusätzlich an die UI weiter, damit ein fehlgeschlagener
  // Testversand nicht als stiller Erfolg erscheint (Nutzer-Bugreport,
  // 2026-08-30: "ich bekomme keine Testmails" – bis dahin gab es dafür
  // keinerlei Rückmeldung).
  private async deliver(
    to: string,
    subject: string,
    text: string,
    attachments?: MailAttachment[],
    // Nur gesetzt, wenn die Vorlage eine Hülle hat – die trägt dann bereits
    // Kopf/Fuß/CI, der automatische Firmen-Footer aus `appendFooter()`
    // würde sich damit überschneiden/wiederholen.
    html?: string,
  ): Promise<{ ok: boolean; error?: string }> {
    const fullText = html ? text : await this.appendFooter(text);
    const cfg = await this.loadConfig();
    if (!cfg) {
      this.logger.log(`[Dev-Stub] "${subject}" an ${to}: ${fullText}`);
      return { ok: false, error: 'Kein SMTP-Server hinterlegt.' };
    }
    try {
      const info = (await this.buildTransport(cfg).sendMail({
        from: this.formatFrom(cfg),
        to,
        subject,
        text: fullText,
        html,
        attachments,
      })) as { rejected?: unknown[] };
      // `sendMail()` löst schon dann auf, wenn der Server die Nachricht
      // angenommen hat – bei mehreren Empfängern (hier nie der Fall, aber
      // zur Sicherheit) kann er einzelne trotzdem ablehnen, das steht dann
      // in `info.rejected`, nicht in einer Exception.
      if (info.rejected && info.rejected.length > 0) {
        return {
          ok: false,
          error: `Vom Mailserver abgelehnt: ${info.rejected.join(', ')}`,
        };
      }
      return { ok: true };
    } catch (err) {
      const error = (err as Error).message;
      this.logger.error(
        `Mailversand an ${to} fehlgeschlagen ("${subject}"): ${error}`,
      );
      return { ok: false, error };
    }
  }

  private renderPlaceholders(
    text: string,
    vars: Record<string, string>,
  ): string {
    return text.replace(/\{\{(\w+)\}\}/g, (_match, key: string) =>
      key in vars ? vars[key] : '',
    );
  }

  // `unknown`-sichere HTML-Erzeugung aus dem (weiterhin per Textarea
  // gepflegten) Klartext jeder System-/Formular-Vorlage (Nutzer-Korrektur,
  // 2026-08-30: "meine System-E-Mails haben alle kein Style" – individuelle
  // Vorlagen wurden entfernt, das Design der Hülle gilt jetzt stattdessen
  // für JEDE Vorlage). Erst escapen (keine HTML-Injection über
  // Platzhalterwerte wie einen Nutzernamen), dann `http(s)://`-Links
  // klickbar machen, dann in Absätze umbrechen.
  private static escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  private static linkify(escaped: string): string {
    return escaped.replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1">$1</a>');
  }

  private plainTextToHtml(text: string): string {
    return text
      .split(/\n{2,}/)
      .map(
        (para) =>
          `<p>${MailerService.linkify(MailerService.escapeHtml(para)).replace(/\n/g, '<br>')}</p>`,
      )
      .join('\n');
  }

  /** Lädt die aktuell gültige System-Vorlage (DB-Override oder
   * Standardtext), ersetzt die Platzhalter und setzt das Ergebnis in die
   * gewählte (oder Standard-)Hülle ein. `null` = Vorlage ist pausiert
   * ("Versand aktiv" aus) – der Aufrufer überspringt den Versand dann
   * kommentarlos, wie ein pausierter Job. */
  private async renderSystemTemplate(
    key: string,
    vars: Record<string, string>,
    options?: { ignoreEnabled?: boolean },
  ): Promise<RenderedMail | null> {
    const fallback = SYSTEM_MAIL_TEMPLATES.find((t) => t.key === key);
    if (!fallback) {
      throw new Error(`Unbekannter Mail-Vorlagen-Schlüssel: ${key}`);
    }
    const override = await this.prisma.mailTemplate.findUnique({
      where: { key },
    });
    if (override && !override.enabled && !options?.ignoreEnabled) return null;
    const subject = this.renderPlaceholders(
      override?.subject ?? fallback.subject,
      vars,
    );
    const text = this.renderPlaceholders(override?.body ?? fallback.body, vars);
    const html = await this.renderInShell(text, override?.shellId ?? null);
    return { subject, text, html };
  }

  private async renderFormTemplate(
    formId: string,
    kind: FormMailKind,
    vars: Record<string, string>,
    options?: { ignoreEnabled?: boolean },
  ): Promise<RenderedMail | null> {
    const form = await this.prisma.form.findUnique({ where: { id: formId } });
    if (!form) return null;
    const fallback = defaultFormTemplate(form, kind);
    const override = await this.prisma.mailTemplate.findUnique({
      where: { formId_formKind: { formId, formKind: kind } },
    });
    if (override && !override.enabled && !options?.ignoreEnabled) return null;
    const subject = this.renderPlaceholders(
      override?.subject ?? fallback.subject,
      vars,
    );
    const text = this.renderPlaceholders(override?.body ?? fallback.body, vars);
    const html = await this.renderInShell(text, override?.shellId ?? null);
    return { subject, text, html };
  }

  // Mitgelieferte, neutrale Standard-Hülle (Nutzervorgabe: eine neue,
  // noch nicht konfigurierte Installation braucht trotzdem sofort
  // brauchbare Mails) – greift, solange kein Client eine eigene Hülle
  // gebaut hat.
  private static readonly DEFAULT_SHELL_CONTENT = `<div style="max-width:600px;margin:0 auto;padding:32px 24px;font-family:sans-serif;color:#111827;">${MAIL_SHELL_CONTENT_PLACEHOLDER}</div>`;

  /** Setzt den gerenderten Vorlagen-Inhalt an der `{{content}}`-Stelle der
   * gewählten (oder Standard-)Hülle ein. `shellId` ohne Treffer fällt auf
   * die Standard-Hülle der Installation zurück, keine Hülle konfiguriert
   * fällt auf die mitgelieferte Standard-Hülle zurück (siehe oben). */
  private async wrapInShell(
    contentHtml: string,
    shellId: string | null,
  ): Promise<string> {
    const shell = shellId
      ? await this.prisma.mailShell.findUnique({ where: { id: shellId } })
      : await this.prisma.mailShell.findFirst({ where: { isDefault: true } });
    const shellContent = shell?.content ?? MailerService.DEFAULT_SHELL_CONTENT;
    return shellContent.replaceAll(MAIL_SHELL_CONTENT_PLACEHOLDER, contentHtml);
  }

  /** Klartext einer Vorlage → fertiges, CSS-inlined HTML in der gewählten
   * Hülle. Fertig gestaltete, von einer Agentur exportierte Hüllen bringen
   * oft `<style>`-Blöcke mit Klassen mit, die viele Mail-Programme (allen
   * voran Outlook) ignorieren – `juice` schreibt die Styles direkt in
   * jedes Element (`style="..."`), auf das fertige Gesamt-HTML (Hülle +
   * Inhalt zusammen). */
  private async renderInShell(
    text: string,
    shellId: string | null,
  ): Promise<string> {
    const combined = await this.wrapInShell(
      this.plainTextToHtml(text),
      shellId,
    );
    return juice(combined);
  }

  async sendVerificationEmail(to: string, link: string): Promise<void> {
    const rendered = await this.renderSystemTemplate('auth.verify-email', {
      link,
    });
    if (!rendered) return;
    await this.deliver(
      to,
      rendered.subject,
      rendered.text,
      undefined,
      rendered.html,
    );
  }

  async sendPasswordResetEmail(to: string, link: string): Promise<void> {
    const rendered = await this.renderSystemTemplate('auth.password-reset', {
      link,
    });
    if (!rendered) return;
    await this.deliver(
      to,
      rendered.subject,
      rendered.text,
      undefined,
      rendered.html,
    );
  }

  /** Datenschutzbeauftragter-Tab, Schalter "Bei jedem Vorfall automatisch
   * benachrichtigen". */
  async sendDpoIncidentNotification(
    to: string,
    incident: { title: string; severity: string },
  ): Promise<void> {
    const rendered = await this.renderSystemTemplate(
      'privacy.dpo-incident-notification',
      { title: incident.title, severity: incident.severity },
    );
    if (!rendered) return;
    await this.deliver(
      to,
      rendered.subject,
      rendered.text,
      undefined,
      rendered.html,
    );
  }

  /** Datenschutzbeauftragter-Tab, Schalter "Monatsbericht per E-Mail" –
   * ausgelöst vom Cron in PrivacyReportSchedulerService. */
  async sendDpoMonthlyReport(to: string, csv: string): Promise<void> {
    const rows = csv.split('\n').length - 1;
    const rendered = await this.renderSystemTemplate(
      'privacy.dpo-monthly-report',
      { rows: String(rows) },
    );
    if (!rendered) return;
    await this.deliver(
      to,
      rendered.subject,
      rendered.text,
      [
        {
          filename: 'monatsbericht.csv',
          content: csv,
          contentType: 'text/csv; charset=utf-8',
        },
      ],
      rendered.html,
    );
  }

  /** "Auskunft senden" (Betroffenenrechte-Kachel, Art. 15 DSGVO) – nutzt
   * die im Konto hinterlegte E-Mail-Adresse, kein separates
   * Empfänger-Feld. */
  async sendSubjectAccessReport(to: string, csv: string): Promise<void> {
    const rows = csv.split('\n').length - 1;
    const rendered = await this.renderSystemTemplate(
      'privacy.subject-access-report',
      { rows: String(rows) },
    );
    if (!rendered) return;
    await this.deliver(
      to,
      rendered.subject,
      rendered.text,
      [
        {
          filename: 'auskunft.csv',
          content: csv,
          contentType: 'text/csv; charset=utf-8',
        },
      ],
      rendered.html,
    );
  }

  /** Betroffenenanfragen-Log, Schalter "Eingang automatisch bestätigen":
   * Mail an den Absender direkt beim Anlegen einer neuen Anfrage. */
  async sendDeletionRequestAcknowledgement(
    to: string,
    dsrId: string,
  ): Promise<void> {
    const rendered = await this.renderSystemTemplate(
      'privacy.deletion-request-acknowledgement',
      { dsrId },
    );
    if (!rendered) return;
    await this.deliver(
      to,
      rendered.subject,
      rendered.text,
      undefined,
      rendered.html,
    );
  }

  /** Betroffenenanfragen-Log, Button "Rückfrage an Absender" – der Admin
   * formuliert die Rückfrage selbst im Popup, kein fester Textbaustein
   * (daher keine Vorlage, siehe mail-templates.catalog.ts). */
  async sendDeletionRequestFollowUp(
    to: string,
    dsrId: string,
    message: string,
  ): Promise<void> {
    await this.deliver(to, `Rückfrage zu Ihrer Anfrage (${dsrId})`, message);
  }

  /** Betroffenenanfragen-Log, Schalter "Erinnerung 7 Tage vor Fristende" –
   * Mail an den Datenschutzbeauftragten, nicht an den Absender. */
  async sendDeletionRequestDeadlineReminder(
    to: string,
    dsrId: string,
    dueAt: Date,
  ): Promise<void> {
    const rendered = await this.renderSystemTemplate(
      'privacy.deletion-request-deadline-reminder',
      { dsrId, dueAt: dueAt.toLocaleDateString('de-DE') },
    );
    if (!rendered) return;
    await this.deliver(
      to,
      rendered.subject,
      rendered.text,
      undefined,
      rendered.html,
    );
  }

  /** Auftragsverarbeiter-Tab, Karte "Offene Punkte", Button "AV-Vertrag
   * anfordern". */
  async sendDataProcessorContractRequest(
    to: string,
    processorName: string,
  ): Promise<void> {
    const rendered = await this.renderSystemTemplate(
      'privacy.data-processor-contract-request',
      { processorName },
    );
    if (!rendered) return;
    await this.deliver(
      to,
      rendered.subject,
      rendered.text,
      undefined,
      rendered.html,
    );
  }

  /** Systembenachrichtigungen (Wartungsmodus, Speicherplatz, Webhooks
   * usw.) – Titel/Text kommen bereits fertig formuliert aus
   * NotificationsService, daher keine Vorlage (siehe
   * mail-templates.catalog.ts). */
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

  /** Formular-Baustein: Admin-Benachrichtigung nach jeder Einsendung. */
  async sendFormAdminNotification(
    form: { id: string; name: string },
    to: string,
    fieldValues: Record<string, string>,
  ): Promise<void> {
    const rendered = await this.renderFormTemplate(
      form.id,
      'admin_notification',
      {
        ...fieldValues,
        formName: form.name,
        submittedAt: new Date().toLocaleString('de-DE'),
      },
    );
    if (!rendered) return;
    await this.deliver(
      to,
      rendered.subject,
      rendered.text,
      undefined,
      rendered.html,
    );
  }

  /** Formular-Baustein: Bestätigung an den Absender, nur wenn das
   * Formular ein E-Mail-Feld hat und `sendConfirmation` aktiv ist (siehe
   * FormsService.submit()). */
  async sendFormConfirmation(
    form: { id: string; name: string },
    to: string,
    fieldValues: Record<string, string>,
  ): Promise<void> {
    const rendered = await this.renderFormTemplate(form.id, 'confirmation', {
      ...fieldValues,
      formName: form.name,
      submittedAt: new Date().toLocaleString('de-DE'),
    });
    if (!rendered) return;
    await this.deliver(
      to,
      rendered.subject,
      rendered.text,
      undefined,
      rendered.html,
    );
  }

  private frontendOrigin(): string {
    return this.config.get<string>('CORS_ORIGIN', 'http://localhost:3000');
  }

  // ---------- Mailing (Einstellungen → Mailing) ----------
  // Vereinheitlichte Liste aus System-Mails UND formulargebundenen
  // Vorlagen (Nutzervorgabe: zusammen unter Mailing bearbeitbar). Die Id
  // ist entweder der feste `key` (System-Mails, enthält kein ":") oder
  // `${formId}:${formKind}` (Formular-Vorlagen) – daran wird in
  // updateMailTemplate()/resetMailTemplate()/sendMailTemplateTest()
  // unterschieden. Individuelle ("kind: custom") Vorlagen gab es
  // zwischenzeitlich (2026-08-30), wurden aber wieder entfernt: es gab
  // keinen einzigen echten Auslöser dafür, nur den manuellen
  // Testversand – siehe knowledge-base/content/forms.md. Das Design der
  // Hülle (`shellId`) gilt seitdem für JEDE Vorlage.

  private isFormTemplateId(id: string): boolean {
    return id.includes(':');
  }

  private splitFormTemplateId(id: string): {
    formId: string;
    formKind: FormMailKind;
  } {
    const [formId, formKind] = id.split(':');
    return { formId, formKind: formKind as FormMailKind };
  }

  private async assertShellExists(shellId: string): Promise<void> {
    const shell = await this.prisma.mailShell.findUnique({
      where: { id: shellId },
    });
    if (!shell) {
      throw new NotFoundException(`Unbekanntes E-Mail-Template: ${shellId}`);
    }
  }

  async listMailTemplates(): Promise<MailTemplateListItem[]> {
    const overrides = await this.prisma.mailTemplate.findMany();
    const overrideByKey = new Map(
      overrides.filter((o) => o.key).map((o) => [o.key as string, o]),
    );
    const overrideByForm = new Map(
      overrides
        .filter((o) => o.formId && o.formKind)
        .map((o) => [`${o.formId}:${o.formKind}`, o]),
    );

    const systemItems: MailTemplateListItem[] = SYSTEM_MAIL_TEMPLATES.map(
      (def) => {
        const override = overrideByKey.get(def.key);
        return {
          id: def.key,
          category: def.category,
          label: def.label,
          subject: override?.subject ?? def.subject,
          body: override?.body ?? def.body,
          enabled: override?.enabled ?? true,
          recipientTo: def.recipientEditable
            ? (override?.recipientTo ?? null)
            : null,
          recipientEditable: def.recipientEditable,
          placeholders: def.placeholders,
          isCustomized: Boolean(override),
          formId: null,
          shellId: override?.shellId ?? null,
        };
      },
    );

    const forms = await this.prisma.form.findMany({
      where: { deletedAt: null },
      select: { id: true, name: true, fields: true },
      orderBy: { name: 'asc' },
    });
    const formItems: MailTemplateListItem[] = forms.flatMap((form) => {
      const placeholders = [
        ...formFieldPlaceholders(form.fields),
        'formName',
        'submittedAt',
      ];
      const placeholderLabels = {
        ...formFieldLabels(form.fields),
        formName: 'Name des Formulars',
        submittedAt: 'Zeitpunkt der Einsendung',
      };
      return (['admin_notification', 'confirmation'] as const).map((kind) => {
        const virtualId = `${form.id}:${kind}`;
        const override = overrideByForm.get(virtualId);
        const fallback = defaultFormTemplate(form, kind);
        return {
          id: virtualId,
          category: 'forms' as const,
          label: `${form.name} – ${
            kind === 'admin_notification'
              ? 'Admin-Benachrichtigung'
              : 'Bestätigung an Absender'
          }`,
          subject: override?.subject ?? fallback.subject,
          body: override?.body ?? fallback.body,
          enabled: override?.enabled ?? true,
          recipientTo:
            kind === 'admin_notification'
              ? (override?.recipientTo ?? null)
              : null,
          recipientEditable: kind === 'admin_notification',
          placeholders,
          placeholderLabels,
          isCustomized: Boolean(override),
          formId: form.id,
          shellId: override?.shellId ?? null,
        };
      });
    });

    return [...systemItems, ...formItems];
  }

  async updateMailTemplate(id: string, dto: UpdateMailTemplateInput) {
    if (dto.shellId) {
      await this.assertShellExists(dto.shellId);
    }

    if (this.isFormTemplateId(id)) {
      const { formId, formKind } = this.splitFormTemplateId(id);
      const form = await this.prisma.form.findUnique({
        where: { id: formId },
      });
      if (!form) {
        throw new NotFoundException(`Formular ${formId} nicht gefunden.`);
      }
      const fallback = defaultFormTemplate(form, formKind);
      const recipientEditable = formKind === 'admin_notification';
      return this.prisma.mailTemplate.upsert({
        where: { formId_formKind: { formId, formKind } },
        create: {
          formId,
          formKind,
          subject: dto.subject ?? fallback.subject,
          body: dto.body ?? fallback.body,
          enabled: dto.enabled ?? true,
          shellId: dto.shellId ?? null,
          recipientTo: recipientEditable ? (dto.recipientTo ?? null) : null,
        },
        update: {
          subject: dto.subject,
          body: dto.body,
          enabled: dto.enabled,
          shellId: dto.shellId === undefined ? undefined : dto.shellId,
          recipientTo: recipientEditable ? dto.recipientTo : undefined,
        },
      });
    }

    const fallback = SYSTEM_MAIL_TEMPLATES.find((t) => t.key === id);
    if (!fallback) {
      throw new NotFoundException(`Unbekannte Mail-Vorlage: ${id}`);
    }
    return this.prisma.mailTemplate.upsert({
      where: { key: id },
      create: {
        key: id,
        subject: dto.subject ?? fallback.subject,
        body: dto.body ?? fallback.body,
        enabled: dto.enabled ?? true,
        shellId: dto.shellId ?? null,
        recipientTo: fallback.recipientEditable
          ? (dto.recipientTo ?? null)
          : null,
      },
      update: {
        subject: dto.subject,
        body: dto.body,
        enabled: dto.enabled,
        shellId: dto.shellId === undefined ? undefined : dto.shellId,
        recipientTo: fallback.recipientEditable ? dto.recipientTo : undefined,
      },
    });
  }

  /** "Auf Standard zurücksetzen" – System-/Formular-Vorlagen haben immer
   * einen Katalog-Fallback, "zurücksetzen" heißt hier einfach die
   * Override-Zeile (inkl. gewählter Hülle) zu löschen. */
  async resetMailTemplate(id: string): Promise<void> {
    if (this.isFormTemplateId(id)) {
      const { formId, formKind } = this.splitFormTemplateId(id);
      await this.prisma.mailTemplate.deleteMany({
        where: { formId, formKind },
      });
      return;
    }
    await this.prisma.mailTemplate.deleteMany({ where: { key: id } });
  }

  /** Vorlagen-Editor, Button "Testmail senden" – rendert mit Beispielwerten
   * und verschickt unabhängig vom "Versand aktiv"-Schalter (der Nutzer
   * will die Vorlage sehen, nicht den Pausenzustand testen). */
  async sendMailTemplateTest(
    id: string,
    to: string,
  ): Promise<{ ok: boolean; error?: string }> {
    if (this.isFormTemplateId(id)) {
      const { formId, formKind } = this.splitFormTemplateId(id);
      const form = await this.prisma.form.findUnique({
        where: { id: formId },
      });
      if (!form) {
        throw new NotFoundException(`Formular ${formId} nicht gefunden.`);
      }
      const fields = formFieldPlaceholders(form.fields);
      const vars = Object.fromEntries(
        fields.map((id) => [id, `Beispielwert (${id})`]),
      );
      const rendered = await this.renderFormTemplate(formId, formKind, vars, {
        ignoreEnabled: true,
      });
      if (!rendered) {
        return { ok: false, error: 'Vorlage ist pausiert.' };
      }
      return this.deliver(
        to,
        `[Test] ${rendered.subject}`,
        rendered.text,
        undefined,
        rendered.html,
      );
    }

    const def = SYSTEM_MAIL_TEMPLATES.find((t) => t.key === id);
    if (!def) {
      throw new NotFoundException(`Unbekannte Mail-Vorlage: ${id}`);
    }
    const vars = Object.fromEntries(
      def.placeholders.map((p) => [p, `Beispielwert (${p})`]),
    );
    const rendered = await this.renderSystemTemplate(id, vars, {
      ignoreEnabled: true,
    });
    if (!rendered) {
      return { ok: false, error: 'Vorlage ist pausiert.' };
    }
    return this.deliver(
      to,
      `[Test] ${rendered.subject}`,
      rendered.text,
      undefined,
      rendered.html,
    );
  }

  // ---------- E-Mail-Hüllen (Einstellungen → Mailing) ----------
  // Nutzervorgabe, 2026-08-30: "mache mehrere Hüllen für eine Installation
  // möglich" – eigene Tabelle statt eines einzelnen Felds, genau eine
  // davon `isDefault`.

  async listMailShells(): Promise<MailShellListItem[]> {
    const shells = await this.prisma.mailShell.findMany({
      orderBy: { name: 'asc' },
      include: { _count: { select: { templates: true } } },
    });
    return shells.map((s) => ({
      id: s.id,
      name: s.name,
      content: s.content,
      isDefault: s.isDefault,
      updatedAt: s.updatedAt,
      usedByCount: s._count.templates,
    }));
  }

  /** "+ Neue Hülle" – erste angelegte Hülle wird automatisch Standard
   * (sonst gäbe es sonst kurzzeitig gar keine Standard-Hülle). */
  async createMailShell(dto: CreateMailShellInput) {
    const existingCount = await this.prisma.mailShell.count();
    return this.prisma.mailShell.create({
      data: {
        name: dto.name,
        content: MailerService.DEFAULT_SHELL_CONTENT,
        isDefault: existingCount === 0,
      },
    });
  }

  async updateMailShell(id: string, dto: UpdateMailShellInput) {
    const existing = await this.prisma.mailShell.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException(`Unbekannte E-Mail-Hülle: ${id}`);
    }
    if (dto.content !== undefined && !hasShellContentPlaceholder(dto.content)) {
      throw new BadRequestException(
        `Die Hülle muss den Platzhalter ${MAIL_SHELL_CONTENT_PLACEHOLDER} genau einmal enthalten.`,
      );
    }
    // Genau eine Standard-Hülle pro Installation – eine neue Standard-
    // Markierung nimmt sie allen anderen weg, statt mehrere zuzulassen.
    if (dto.isDefault) {
      await this.prisma.mailShell.updateMany({
        where: { id: { not: id }, isDefault: true },
        data: { isDefault: false },
      });
    }
    return this.prisma.mailShell.update({
      where: { id },
      data: {
        name: dto.name,
        content: dto.content,
        isDefault: dto.isDefault,
      },
    });
  }

  /** Löschschutz: eine Hülle, die aktuell von mindestens einer Vorlage
   * genutzt wird oder die Standard-Hülle ist, kann nicht gelöscht werden
   * – gleiches Prinzip wie an anderen Stellen im System (z.B. Rollen/
   * Ordner in Benutzung). */
  async deleteMailShell(id: string): Promise<void> {
    const shell = await this.prisma.mailShell.findUnique({
      where: { id },
      include: { _count: { select: { templates: true } } },
    });
    if (!shell) return;
    if (shell.isDefault) {
      throw new BadRequestException(
        'Die Standard-Hülle kann nicht gelöscht werden. Erst eine andere Hülle als Standard festlegen.',
      );
    }
    if (shell._count.templates > 0) {
      throw new BadRequestException(
        `Diese Hülle wird noch von ${shell._count.templates} ${shell._count.templates === 1 ? 'Vorlage' : 'Vorlagen'} genutzt.`,
      );
    }
    await this.prisma.mailShell.delete({ where: { id } });
  }
}
