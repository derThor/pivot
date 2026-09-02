import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { MailerService } from '../mailer/mailer.service';
import { AuthService } from '../auth/auth.service';
import { UpdateSettingsDto } from './dto/update-settings.dto';
import { UpdateMaintenancePageDto } from './dto/update-maintenance-page.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';
import { UpdatePrivacyDto } from './dto/update-privacy.dto';
import { UpdatePrivacyDsbDto } from './dto/update-privacy-dsb.dto';
import { UpdatePrivacySccTemplateDto } from './dto/update-privacy-scc-template.dto';
import { UpdateSmtpSettingsDto } from './dto/update-smtp-settings.dto';
import { UpdateLicenseClientSettingsDto } from './dto/update-license-client-settings.dto';
import { encryptSecret } from '../common/utils/secret-encryption';
import { getAppVersion } from '../common/utils/app-version';

function csvEscape(v: unknown): string {
  return `"${String(v).replace(/"/g, '""')}"`;
}

// Ohne BOM interpretieren Excel/Windows-Editoren die UTF-8-Datei als
// Windows-1252 und zeigen Umlaute als Mojibake – gleiches Muster wie
// PrivacyService.CSV_BOM (dort ausführlicher kommentiert), hier separat
// dupliziert statt geteilt, da PrivacyService es nicht exportiert.
const CSV_BOM = '﻿';

// Für Protokoll-Einträge ohne `metadata.field` (reine Aktionen statt
// Feldänderungen) – CSV-Pendant zum gleichnamigen Frontend-Mapping in
// settings-protocol-card.tsx. Bisher nur "Alle löschen" bei den
// Job-Läufen unter Einstellungen → Jobs (Nutzervorgabe, 2026-08-22).
const ACTION_LABELS: Record<string, string> = {
  'settings.job_runs_deleted': 'Job-Lauf-Historie gelöscht',
};

// Deutsche Labels für die "Feld"-Spalte im CSV-Export (Nutzer-Bugreport,
// 2026-08-30: die Protokoll-Karte selbst übersetzt über
// SETTINGS_FIELD_LABELS in apps/web/src/lib/settings-change-labels.ts,
// der CSV-Export schrieb bisher aber `metadata.field` roh in die Datei –
// "activityLogRetentionDays" statt "Aktivitäten-Historie aufbewahren").
// Hier separat dupliziert statt geteilt (kein gemeinsames Package
// zwischen apps/api und apps/web außer @pivot/database), gleiches Muster
// wie ACTION_LABELS oben – bei einem neuen protokollierten Feld IMMER
// BEIDE Maps pflegen, sonst taucht der rohe Feldname wieder irgendwo auf.
const FIELD_LABELS: Record<string, string> = {
  allowRegistration: 'Registrierung erlauben',
  allowPasswordReset: 'Passwort-vergessen erlauben',
  allowEmailChange: 'Benutzer können E-Mail-Adresse anpassen',
  allowAdminEmailChange: 'Administratoren können E-Mail-Adresse anpassen',
  requireAdminActivation: 'Admin-Freischaltung erforderlich',
  autosaveEnabled: 'Autosave im Content-Editor',
  mediaResponsiveVariantsEnabled: 'Automatische Bildvarianten',
  maintenanceModeEnabled: 'Wartungsmodus',
  mediaStorageQuotaMb: 'Medien-Speicherkontingent',
  maxUploadSizeMb: 'Maximale Dateigröße pro Upload',
  passwordMinLength: 'Passwort-Mindestlänge',
  passwordRequireUppercase: 'Groß-/Kleinschreibung und Zahl erforderlich',
  passwordRequireLowercase: 'Groß-/Kleinschreibung und Zahl erforderlich',
  passwordRequireNumber: 'Groß-/Kleinschreibung und Zahl erforderlich',
  passwordRequireSpecialChar: 'Sonderzeichen erforderlich',
  passwordExpiryDays: 'Passwortwechsel nach Tagen',
  failedLoginLockoutThreshold: 'Sperre nach Fehlversuchen',
  passwordBlockLeaked: 'Bekannte geleakte Passwörter blockieren',
  passwordPreventReuseEnabled: 'Letzte 5 Passwörter nicht erneut zulassen',
  allowTwoFactor: '2FA verfügbar machen',
  requireTwoFactorForAdmins: 'Zwei-Faktor für Administratoren erzwingen',
  requireTwoFactorForAll: 'Zwei-Faktor für alle Konten erzwingen',
  requireTwoFactorForPublishers:
    'Zwei-Faktor für Rollen mit Veröffentlichungsrecht',
  sessionIdleTimeoutMinutes: 'Sitzungs-Timeout bei Inaktivität',
  defaultPageSize: 'Einträge pro Seite',
  accentColor: 'Akzentfarbe',
  tableDensity: 'Tabellendichte',
  sidebarCollapsedByDefault: 'Seitenleiste eingeklappt starten',
  keyboardShortcutsEnabled: 'Tastaturkürzel aktiv',
  reduceMotion: 'Bewegungen reduzieren',
  companyLogoUrl: 'Firmenlogo',
  companyLogoUrlDark: 'Firmenlogo (Dunkelmodus)',
  notifyMaintenanceMode: 'Benachrichtigung „Wartungsmodus“',
  notifyStorageQuota: 'Benachrichtigung „Speicherplatz fast voll“',
  notifyWebhookFailures: 'Benachrichtigung „Fehlschlagende Webhooks“',
  notifyLocalDrafts: 'Benachrichtigung „Lokale Entwürfe“',
  notifyPendingActivations: 'Benachrichtigung „Wartende Freischaltungen“',
  notifyFailedLogins: 'Benachrichtigung „Auffällige Fehlversuche“',
  notifyPendingPasswordChanges: 'Benachrichtigung „Anstehende Passwortwechsel“',
  notifyCompanyIncomplete: 'Benachrichtigung „Unvollständige Firmendaten“',
  notifyLegalDocuments:
    'Benachrichtigung „Rechtstexte brauchen Aufmerksamkeit“',
  notifyDeletionRequests: 'Benachrichtigung „Offene Betroffenenanfragen“',
  notifyTrashExpiring: 'Benachrichtigung „Papierkorb-Einträge laufen ab“',
  formSubmissionDeleteAfterReadDays: 'Einsendungen: Löschung nach Lesen (Tage)',
  formSubmissionNotifyOnNew:
    'Einsendungen: Benachrichtigung bei neuer Einsendung',
  formSubmissionRecipientEmail: 'Einsendungen: Empfänger',
  formSubmissionConfirmationDefault:
    'Einsendungen: Bestätigungsmail als Standard',
  formSubmissionUnreadReminderDays:
    'Einsendungen: Erinnerung bei ungelesenen (Tage)',
  notifyUnreadSubmissions: 'Benachrichtigung „Einsendungen liegen ungelesen“',
  statsAnomalyRelativeDropPercent: 'Zählerstand-Warnschwelle (relativ)',
  statsAnomalyAbsoluteDrop: 'Zählerstand-Warnschwelle (absolut)',
  notificationRecipientEmail: 'Benachrichtigungsempfänger',
  emailSmtp: 'E-Mail-Versand (SMTP)',
  licenseApiKey: 'Lizenz-API-Key',
  jobsGloballyPaused: 'Alle Jobs pausieren',
  jobRunRetentionDays: 'Job-Lauf-Historie aufbewahren',
  activityLogRetentionDays: 'Aktivitäten-Historie aufbewahren',
  siteTitle: 'Website-Titel',
  siteTagline: 'Website-Untertitel',
  faviconUrl: 'Favicon',
  defaultSeoDescription: 'Standard-SEO-Beschreibung',
  defaultOgImageUrl: 'Standard-Social-Media-Bild',
  publicBaseUrl: 'Basis-URL der Website',
  mainNavigationId: 'Hauptmenü',
};

// Firma-Stammdaten-Felder (Verwaltung → Firma, "Letzte Änderungen"-Karte,
// 2026-08-17) – deutsche Labels leben zusätzlich im Frontend
// (company-view.tsx), hier nur als Schlüssel-Liste für die Diff-Prüfung
// in update() unten.
export const COMPANY_FIELD_KEYS = [
  'companyName',
  'companyStreet',
  'companyPostalCode',
  'companyCity',
  'companyCountry',
  'companyRepresentative',
  'companyEmail',
  'companyPhone',
  'companyRegisterCourt',
  'companyRegisterNumber',
  'companyVatId',
  'companySupervisoryAuthority',
  'companyDisputeResolution',
] as const;

const COMPANY_ENTITY_TYPE = 'Company';
const COMPANY_ENTITY_ID = 'company';

// Alle übrigen (echten) System-Einstellungen – "Protokoll"-Tab unter
// Einstellungen (Nutzervorgabe, 2026-08-22: "baue protokolierung", 1:1
// nach Bildvorlage "Letzte Änderungen an den Einstellungen"). Bewusst
// ausdrücklich NICHT Firma-/Datenschutz-Felder (siehe COMPANY_FIELD_KEYS/
// PRIVACY_FIELD_KEYS oben) – die haben mit company.field_updated bereits
// ihre eigene, unveränderte Historie auf der Firma-Seite; Datenschutz-
// Feldänderungen werden aktuell bewusst noch nirgends protokolliert
// (kein Datenschutz-Protokoll angefragt).
export const SETTINGS_ENTITY_TYPE = 'Settings';
export const SETTINGS_ENTITY_ID = 'settings';

// Datenschutz-relevante Felder (DSB-Kontakt, Aufbewahrung, Formulare,
// SCC-Vorlage) – siehe UpdatePrivacyDto. Eigenes Recht `privacy:*` statt
// `settings:*` (Nutzer-Bugreport, 2026-08-21).
export const PRIVACY_FIELD_KEYS = [
  'dpoIsExternal',
  'dpoName',
  'dpoCompany',
  'dpoEmail',
  'dpoPhone',
  'dpoAppointedAt',
  'dpoReportedAt',
  'dpoSupervisoryAuthority',
  'dpoLastContactAt',
  'dpoListInLegalTexts',
  'dpoNotifyOnIncident',
  'dpoMonthlyReportEnabled',
  'retentionFormSubmissionsDays',
  'retentionAccessLogMonths',
  'retentionDeactivatedAccountsMonths',
  'retentionTrashDays',
  'dsbFormSelfServiceDisclosure',
  'dsbFormStoreSubmissionIp',
  'formSubmissionDeleteAfterReadDays',
  'dsrAutoAcknowledgeReceipt',
  'dsrDeadlineReminderEnabled',
  'sccTemplateMediaId',
  'statsAnomalyRelativeDropPercent',
  'statsAnomalyAbsoluteDrop',
] as const;

// Alle drei unabhängigen 2FA-Pflicht-Stufen (siehe AuthService.
// issueTokens()) – bei Aktivierung einer davon werden alle Sitzungen
// beendet, siehe update() unten.
const TWO_FACTOR_ENFORCEMENT_KEYS = [
  'requireTwoFactorForAll',
  'requireTwoFactorForAdmins',
  'requireTwoFactorForPublishers',
] as const;

@Injectable()
export class SettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
    private readonly mailer: MailerService,
    private readonly config: ConfigService,
    @Inject(forwardRef(() => AuthService))
    private readonly authService: AuthService,
  ) {}

  private get encryptionKey(): string {
    return this.config.getOrThrow<string>('TOTP_ENCRYPTION_KEY');
  }

  async get() {
    return this.prisma.appSettings.upsert({
      where: { id: 1 },
      update: {},
      create: { id: 1 },
    });
  }

  // Eigener, engerer Lesezugriff für `company:read` (siehe
  // UpdateCompanyDto) – gibt bewusst nur die Firma-Felder zurück, nicht
  // die komplette `AppSettings`-Zeile. Sonst könnte jemand mit
  // ausschließlich `company:read` (z.B. Administrator ohne `settings:*`)
  // über diesen Umweg trotzdem alle globalen Einstellungen mitlesen.
  async getCompany() {
    const settings = await this.get();
    return Object.fromEntries(
      COMPANY_FIELD_KEYS.map((key) => [key, settings[key]]),
    ) as Record<(typeof COMPANY_FIELD_KEYS)[number], string>;
  }

  async updateCompany(dto: UpdateCompanyDto, actingUserId: string) {
    await this.update(dto, actingUserId);
    // Nur die Firma-Felder zurückgeben, nicht die komplette Zeile (siehe
    // getCompany() oben – gleicher Grund).
    return this.getCompany();
  }

  // Eigene, schmale Route für die Wartungsseite (siehe
  // UpdateMaintenancePageDto/LicenseEnforcementGuard) – gleiches
  // Rückgabe-Muster wie updateCompany()/updatePrivacy(): nur die zwei
  // betroffenen Felder, nicht die komplette AppSettings-Zeile inkl.
  // verschlüsselter Secrets (SMTP-Passwort, Lizenz-API-Key).
  async updateMaintenancePage(
    dto: UpdateMaintenancePageDto,
    actingUserId: string,
  ) {
    await this.update(dto, actingUserId);
    const settings = await this.get();
    return {
      maintenancePageTitle: settings.maintenancePageTitle,
      maintenancePageMessage: settings.maintenancePageMessage,
    };
  }

  // Gleiches Muster wie getCompany()/updateCompany() für `privacy:*`.
  async getPrivacy() {
    const settings = await this.get();
    return Object.fromEntries(
      PRIVACY_FIELD_KEYS.map((key) => [key, settings[key]]),
    ) as Record<(typeof PRIVACY_FIELD_KEYS)[number], unknown>;
  }

  async updatePrivacy(dto: UpdatePrivacyDto, actingUserId: string) {
    await this.update(dto, actingUserId);
    return this.getPrivacy();
  }

  // Datenschutz-als-Modul, 2026-08-28: eigene Methode für den
  // "dsb"-Reiter (siehe UpdatePrivacyDsbDto), damit beide Reiter
  // unabhängig voneinander gegatet werden können, auch wenn beide auf
  // dieselbe `update()`/`getPrivacy()`-Grundlage aufsetzen.
  async updatePrivacyDsb(dto: UpdatePrivacyDsbDto, actingUserId: string) {
    await this.update(dto, actingUserId);
    return this.getPrivacy();
  }

  // Nutzervorgabe, 2026-08-29: `sccTemplateMediaId` gehört inhaltlich zum
  // "Auftragsverarbeiter"-Reiter (Drittlandtransfer-Vorlage), lief bisher
  // aber am `rechtstexte`-gegateten `updatePrivacy()` mit – gleiches
  // Split-Muster wie `updatePrivacyDsb()` oben.
  async updatePrivacySccTemplate(
    dto: UpdatePrivacySccTemplateDto,
    actingUserId: string,
  ) {
    await this.update(dto, actingUserId);
    return this.getPrivacy();
  }

  async getPublic() {
    const settings = await this.get();
    // `deletedAt: null`: die zugehörige Datei ist im Papierkorb nicht mehr
    // unter der alten URL erreichbar (siehe MediaService.remove()) – ohne
    // diesen Filter würde der "Vorlage herunterladen"-Button auf einen
    // toten Link zeigen, statt sauber zu verschwinden.
    const sccTemplateMedia = settings.sccTemplateMediaId
      ? await this.prisma.media.findFirst({
          where: { id: settings.sccTemplateMediaId, deletedAt: null },
          select: { id: true, filename: true, url: true },
        })
      : null;
    return {
      allowRegistration: settings.allowRegistration,
      allowPasswordReset: settings.allowPasswordReset,
      allowEmailChange: settings.allowEmailChange,
      allowAdminEmailChange: settings.allowAdminEmailChange,
      requireAdminActivation: settings.requireAdminActivation,
      autosaveEnabled: settings.autosaveEnabled,
      mediaResponsiveVariantsEnabled: settings.mediaResponsiveVariantsEnabled,
      maintenanceModeEnabled: settings.maintenanceModeEnabled,
      mediaStorageQuotaMb: settings.mediaStorageQuotaMb,
      maxUploadSizeMb: settings.maxUploadSizeMb,
      passwordMinLength: settings.passwordMinLength,
      passwordRequireUppercase: settings.passwordRequireUppercase,
      passwordRequireLowercase: settings.passwordRequireLowercase,
      passwordRequireNumber: settings.passwordRequireNumber,
      passwordRequireSpecialChar: settings.passwordRequireSpecialChar,
      // Jede Rolle mit Dashboard-Zugriff muss wissen, ob 2FA überhaupt
      // verfügbar ist (Konto-Seite blendet die Einrichtung sonst aus) –
      // gleicher Grund wie bei defaultPageSize/allowEmailChange oben.
      allowTwoFactor: settings.allowTwoFactor,
      defaultPageSize: settings.defaultPageSize,
      accentColor: settings.accentColor,
      tableDensity: settings.tableDensity,
      sidebarCollapsedByDefault: settings.sidebarCollapsedByDefault,
      keyboardShortcutsEnabled: settings.keyboardShortcutsEnabled,
      reduceMotion: settings.reduceMotion,
      notifyMaintenanceMode: settings.notifyMaintenanceMode,
      notifyStorageQuota: settings.notifyStorageQuota,
      notifyWebhookFailures: settings.notifyWebhookFailures,
      notifyLocalDrafts: settings.notifyLocalDrafts,
      notifyPendingActivations: settings.notifyPendingActivations,
      notifyFailedLogins: settings.notifyFailedLogins,
      notifyPendingPasswordChanges: settings.notifyPendingPasswordChanges,
      notifyCompanyIncomplete: settings.notifyCompanyIncomplete,
      notifyLegalDocuments: settings.notifyLegalDocuments,
      // Für die öffentliche Wartungsseite einer gesperrten Slave-
      // Installation (kein Login vorhanden, siehe MaintenancePage in
      // apps/web) – bewusst hier statt nur in der Pivot-only `/settings`-
      // Antwort.
      maintenancePageTitle: settings.maintenancePageTitle,
      maintenancePageMessage: settings.maintenancePageMessage,
      companyLogoUrl: settings.companyLogoUrl,
      companyLogoUrlDark: settings.companyLogoUrlDark,
      companyName: settings.companyName,
      companyStreet: settings.companyStreet,
      companyPostalCode: settings.companyPostalCode,
      companyCity: settings.companyCity,
      companyCountry: settings.companyCountry,
      companyRepresentative: settings.companyRepresentative,
      companyEmail: settings.companyEmail,
      companyPhone: settings.companyPhone,
      companyRegisterCourt: settings.companyRegisterCourt,
      companyRegisterNumber: settings.companyRegisterNumber,
      companyVatId: settings.companyVatId,
      companySupervisoryAuthority: settings.companySupervisoryAuthority,
      companyDisputeResolution: settings.companyDisputeResolution,
      dpoIsExternal: settings.dpoIsExternal,
      dpoName: settings.dpoName,
      dpoCompany: settings.dpoCompany,
      dpoEmail: settings.dpoEmail,
      dpoPhone: settings.dpoPhone,
      dpoAppointedAt: settings.dpoAppointedAt,
      dpoReportedAt: settings.dpoReportedAt,
      dpoSupervisoryAuthority: settings.dpoSupervisoryAuthority,
      dpoLastContactAt: settings.dpoLastContactAt,
      dpoListInLegalTexts: settings.dpoListInLegalTexts,
      dpoNotifyOnIncident: settings.dpoNotifyOnIncident,
      dpoMonthlyReportEnabled: settings.dpoMonthlyReportEnabled,
      retentionFormSubmissionsDays: settings.retentionFormSubmissionsDays,
      retentionAccessLogMonths: settings.retentionAccessLogMonths,
      retentionDeactivatedAccountsMonths:
        settings.retentionDeactivatedAccountsMonths,
      retentionTrashDays: settings.retentionTrashDays,
      dsbFormSelfServiceDisclosure: settings.dsbFormSelfServiceDisclosure,
      dsbFormStoreSubmissionIp: settings.dsbFormStoreSubmissionIp,
      formSubmissionDeleteAfterReadDays:
        settings.formSubmissionDeleteAfterReadDays,
      dsrAutoAcknowledgeReceipt: settings.dsrAutoAcknowledgeReceipt,
      dsrDeadlineReminderEnabled: settings.dsrDeadlineReminderEnabled,
      notifyDeletionRequests: settings.notifyDeletionRequests,
      notifyTrashExpiring: settings.notifyTrashExpiring,
      statsAnomalyRelativeDropPercent: settings.statsAnomalyRelativeDropPercent,
      statsAnomalyAbsoluteDrop: settings.statsAnomalyAbsoluteDrop,
      sccTemplateMediaId: settings.sccTemplateMediaId,
      sccTemplateMedia,
      // Nutzervorgabe, 2026-08-25: Version dieser Installation klein im
      // Konto-Menü anzeigen – siehe common/utils/app-version.ts.
      appVersion: getAppVersion(),
    };
  }

  async update(dto: UpdateSettingsDto, actingUserId?: string) {
    const existing = await this.get(); // stellt sicher, dass die Zeile existiert
    const updated = await this.prisma.appSettings.update({
      where: { id: 1 },
      data: dto,
    });

    // "Letzte Änderungen" auf der Firma-Seite (Verwaltung → Firma): pro
    // tatsächlich geändertem Stammdaten-Feld ein eigener Eintrag, nicht nur
    // "Einstellungen gespeichert" – deckt sich mit der Bildvorlage
    // ("Telefon aktualisiert", "USt-IdNr. ergänzt", je einzeln gelistet).
    if (actingUserId) {
      for (const key of COMPANY_FIELD_KEYS) {
        if (!(key in dto)) continue;
        const before = existing[key];
        const after = updated[key];
        if (before === after) continue;
        await this.auditLog.record({
          action: 'company.field_updated',
          entityType: COMPANY_ENTITY_TYPE,
          entityId: COMPANY_ENTITY_ID,
          userId: actingUserId,
          metadata: { field: key, wasEmpty: !before },
        });
      }

      // "Protokoll"-Tab unter Einstellungen: alle übrigen Felder (siehe
      // SETTINGS_ENTITY_TYPE oben) – anders als bei Firma reicht hier
      // "wasEmpty" nicht, weil Beschreibungen wie "Passwort-Mindestlänge
      // auf 12 erhöht" den tatsächlichen neuen Wert brauchen, nicht nur
      // ob vorher leer war.
      for (const key of Object.keys(dto)) {
        if (
          (COMPANY_FIELD_KEYS as readonly string[]).includes(key) ||
          (PRIVACY_FIELD_KEYS as readonly string[]).includes(key)
        ) {
          continue;
        }
        const before = existing[key as keyof typeof existing];
        const after = updated[key as keyof typeof updated];
        if (before === after) continue;
        await this.auditLog.record({
          action: 'settings.field_updated',
          entityType: SETTINGS_ENTITY_TYPE,
          entityId: SETTINGS_ENTITY_ID,
          userId: actingUserId,
          metadata: { field: key, before, after },
        });
      }

      // Sofortige Durchsetzung bei Aktivierung einer 2FA-Zwangsstufe
      // (Nutzer-Bugreport, 2026-08-22: "zwei-faktor für alle konten
      // erzwingen funktioniert nicht" – die Prüfung wird nur beim Login
      // bzw. beim ~15-minütigen Token-Refresh neu berechnet, siehe
      // AuthService.issueTokens(); eine schon offene Sitzung bekommt eine
      // frisch aktivierte Pflicht sonst erst mit Verzögerung mit).
      // Nutzerentscheidung: "automatisch alle sitzungen beenden beim
      // umschalten" – nur bei false→true, ein Deaktivieren zwingt niemanden
      // zu irgendetwas und braucht daher keinen Zwangs-Logout.
      const newlyEnforcedTwoFactor = TWO_FACTOR_ENFORCEMENT_KEYS.some(
        (key) => key in dto && !existing[key] && updated[key],
      );
      if (newlyEnforcedTwoFactor) {
        await this.authService.revokeAllSessionsGlobally(actingUserId);
      }
    }

    return updated;
  }

  getCompanyChanges(limit = 5) {
    return this.auditLog.findRecentForEntity(
      COMPANY_ENTITY_TYPE,
      COMPANY_ENTITY_ID,
      limit,
    );
  }

  // "Protokoll"-Tab unter Einstellungen (Nutzervorgabe, 2026-08-22) – echte
  // Pagination statt eines festen Limits wie bei getCompanyChanges(), da
  // hier über die Zeit deutlich mehr Einträge als bei den überschaubaren
  // 13 Firma-Feldern zusammenkommen können.
  getSettingsChanges(page: number, pageSize: number) {
    return this.auditLog.findPaginated(
      [SETTINGS_ENTITY_TYPE],
      SETTINGS_ENTITY_ID,
      page,
      pageSize,
    );
  }

  // Einzelnen Protokoll-Eintrag löschen (Nutzervorgabe, 2026-08-22: "das
  // soll man löschen können") – bewusst NICHT revisionssicher, anders als
  // die Firma-Änderungshistorie.
  deleteSettingsChange(id: string) {
    return this.auditLog.deleteOne(id);
  }

  // "Alle löschen" (Nutzervorgabe, 2026-08-22: "mache bei letzte änderung
  // ... rechts alle löschen dazu").
  deleteAllSettingsChanges() {
    return this.auditLog.deleteAllForEntity(
      [SETTINGS_ENTITY_TYPE],
      SETTINGS_ENTITY_ID,
    );
  }

  // "Einstellungen als JSON" (Nutzervorgabe, 2026-08-22, "Export &
  // Sicherung"-Karte, "Zum Übertragen auf eine zweite Instanz") – die
  // komplette `AppSettings`-Zeile inkl. Firma-/Datenschutz-Feldern, ohne
  // `id` (immer `1`, kein portabler Wert). JSON hat kein BOM-Problem wie
  // CSV, keine Excel-Interpretation involviert.
  async exportSettingsJson() {
    const settings = await this.get();
    // `smtpPasswordEncrypted`/`licenseApiKeyEncrypted` dürfen ein
    // exportiertes JSON niemals verlassen (auch verschlüsselt nicht) – der
    // Export ist zum manuellen Weitergeben gedacht, kein Backup-Format mit
    // vertrauenswürdiger Aufbewahrung.
    const { id, smtpPasswordEncrypted, licenseApiKeyEncrypted, ...rest } =
      settings;
    void id;
    void smtpPasswordEncrypted;
    void licenseApiKeyEncrypted;
    return rest;
  }

  // CSV-Export der kompletten Protokoll-Historie (Nutzervorgabe,
  // 2026-08-22: "füge export hinzu") – gleiches BOM-/Escaping-Muster wie
  // PrivacyService.generateReportCsv() (siehe dortiger Kommentar zu
  // Excel/Windows-Mojibake ohne BOM).
  async exportSettingsChangesCsv(): Promise<string> {
    const rows = await this.auditLog.findAllForEntity(
      [SETTINGS_ENTITY_TYPE],
      SETTINGS_ENTITY_ID,
    );
    const header = ['Datum', 'Feld', 'Vorher', 'Nachher', 'Bearbeiter'].join(
      ',',
    );
    const lines = rows.map((row) => {
      const metadata = row.metadata as {
        field?: string;
        before?: unknown;
        after?: unknown;
      } | null;
      const user = row.user
        ? `${row.user.firstName ?? ''} ${row.user.lastName}`.trim()
        : '';
      const field = metadata?.field;
      return [
        row.createdAt.toISOString(),
        // Für Aktionen ohne echtes Feld (z.B. "Alle löschen" bei den
        // Job-Läufen, siehe ACTION_LABELS in settings-protocol-card.tsx
        // fürs Frontend-Pendant) sonst leere Spalte statt einer
        // aussagekräftigen Beschreibung. Deutsches Label statt des rohen
        // camelCase-Feldnamens (Nutzer-Bugreport, 2026-08-30).
        field
          ? (FIELD_LABELS[field] ?? field)
          : (ACTION_LABELS[row.action] ?? row.action),
        metadata?.before ?? '',
        metadata?.after ?? '',
        user,
      ]
        .map(csvEscape)
        .join(',');
    });
    return CSV_BOM + [header, ...lines].join('\n');
  }

  // Einstellungen → Integrationen, Karte "Dienste" (Nutzervorgabe,
  // 2026-08-22: "email versand bauen ... als dienst"). Passwort kommt nie
  // im Klartext zurück, nur `hasPassword` – anders als bei den echten
  // Formularfeldern (Firma/Datenschutz) gibt es hier kein "leeres Feld
  // bedeutet nichts hinterlegt", ein Passwortfeld zeigt seinen Wert nie an.
  async getSmtpSettings() {
    const settings = await this.get();
    return {
      host: settings.smtpHost,
      port: settings.smtpPort,
      username: settings.smtpUsername,
      hasPassword: !!settings.smtpPasswordEncrypted,
      fromAddress: settings.smtpFromAddress,
      fromName: settings.smtpFromName,
      secure: settings.smtpSecure,
      verifiedAt: settings.smtpVerifiedAt,
      configured: !!settings.smtpHost,
    };
  }

  async updateSmtpSettings(dto: UpdateSmtpSettingsDto, actingUserId: string) {
    const existing = await this.get();
    await this.prisma.appSettings.update({
      where: { id: 1 },
      data: {
        smtpHost: dto.host,
        smtpPort: dto.port,
        smtpUsername: dto.username,
        // Leer gelassen = bestehendes Passwort behalten (siehe
        // UpdateSmtpSettingsDto) – nur bei tatsächlicher Eingabe
        // überschreiben, sonst würde jedes Speichern ohne Passwortfeld das
        // Konto stillschweigend aussperren.
        ...(dto.password
          ? {
              smtpPasswordEncrypted: encryptSecret(
                dto.password,
                this.encryptionKey,
              ),
            }
          : {}),
        smtpFromAddress: dto.fromAddress,
        smtpFromName: dto.fromName,
        ...(dto.secure ? { smtpSecure: dto.secure } : {}),
        // Jede Konfigurationsänderung braucht einen neuen Verbindungstest,
        // bevor der Dienst wieder als "aktiv" gilt.
        smtpVerifiedAt: null,
      },
    });

    await this.auditLog.record({
      action: 'settings.smtp_updated',
      entityType: SETTINGS_ENTITY_TYPE,
      entityId: SETTINGS_ENTITY_ID,
      userId: actingUserId,
      metadata: { field: 'emailSmtp', wasConfigured: !!existing.smtpHost },
    });

    const test = await this.mailer.testConnection();
    if (test.ok) {
      await this.prisma.appSettings.update({
        where: { id: 1 },
        data: { smtpVerifiedAt: new Date() },
      });
    }

    return { ...(await this.getSmtpSettings()), testError: test.error };
  }

  // Einstellungen → Master-Client, Schlüssel-Icon bei "Diese Installation"
  // (Nutzervorgabe, 2026-08-24: "eine Eingabe, wo man den Schlüssel ändern
  // kann") – nur im Client-Modus relevant. Key kommt nie im Klartext
  // zurück, nur `hasApiKey` (gleiches Muster wie `hasPassword` bei SMTP).
  async getLicenseClientSettings() {
    const settings = await this.get();
    return { hasApiKey: !!settings.licenseApiKeyEncrypted };
  }

  async updateLicenseClientSettings(
    dto: UpdateLicenseClientSettingsDto,
    actingUserId: string,
  ) {
    if (!dto.apiKey) {
      return this.getLicenseClientSettings();
    }
    await this.prisma.appSettings.update({
      where: { id: 1 },
      data: {
        licenseApiKeyEncrypted: encryptSecret(dto.apiKey, this.encryptionKey),
      },
    });
    await this.auditLog.record({
      action: 'settings.license_api_key_updated',
      entityType: SETTINGS_ENTITY_TYPE,
      entityId: SETTINGS_ENTITY_ID,
      userId: actingUserId,
      metadata: { field: 'licenseApiKey' },
    });
    return this.getLicenseClientSettings();
  }
}
