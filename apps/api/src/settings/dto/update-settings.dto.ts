import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsInt,
  IsISO8601,
  IsObject,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';

export class UpdateSettingsDto {
  // Siehe knowledge-base/platform/master-slave-licensing.md.
  @ApiPropertyOptional({ enum: ['master', 'slave'] })
  @IsOptional()
  @IsIn(['master', 'slave'])
  deploymentMode?: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  maintenancePageTitle?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  maintenancePageMessage?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  allowRegistration?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  allowPasswordReset?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  allowEmailChange?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  allowAdminEmailChange?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  requireAdminActivation?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  autosaveEnabled?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  mediaResponsiveVariantsEnabled?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  maintenanceModeEnabled?: boolean;

  @ApiPropertyOptional({
    nullable: true,
    description: 'Speicher-Kontingent für Medien in MB, leer = unbegrenzt.',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  mediaStorageQuotaMb?: number | null;

  @ApiPropertyOptional({
    nullable: true,
    description:
      'Maximale Dateigröße pro Upload in MB, leer = nur die technischen Kategorie-Obergrenzen.',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  maxUploadSizeMb?: number | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(4)
  @Max(128)
  passwordMinLength?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  passwordRequireUppercase?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  passwordRequireLowercase?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  passwordRequireNumber?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  passwordRequireSpecialChar?: boolean;

  @ApiPropertyOptional({
    description: 'Globaler Schalter fürs 2FA/TOTP-Feature.',
  })
  @IsOptional()
  @IsBoolean()
  allowTwoFactor?: boolean;

  @ApiPropertyOptional({
    description:
      'Erzwingt bei aktivem allowTwoFactor 2FA für Administrator-Konten.',
  })
  @IsOptional()
  @IsBoolean()
  requireTwoFactorForAdmins?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  defaultPageSize?: number;

  @ApiPropertyOptional({
    description: 'Erzwingt 2FA für jedes Konto, unabhängig von der Rolle.',
  })
  @IsOptional()
  @IsBoolean()
  requireTwoFactorForAll?: boolean;

  @ApiPropertyOptional({
    description: 'Erzwingt 2FA für Rollen mit dem Recht "content:publish".',
  })
  @IsOptional()
  @IsBoolean()
  requireTwoFactorForPublishers?: boolean;

  @ApiPropertyOptional({
    nullable: true,
    description: 'Passwort-Ablauf in Tagen, leer = kein Ablauf.',
  })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsInt()
  @Min(1)
  passwordExpiryDays?: number | null;

  @ApiPropertyOptional({
    nullable: true,
    description:
      'Sperrt ein Konto automatisch nach N Fehlversuchen, leer = keine automatische Sperre.',
  })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsInt()
  @Min(1)
  failedLoginLockoutThreshold?: number | null;

  @ApiPropertyOptional({
    description: 'Prüft neue Passwörter gegen die Have-I-Been-Pwned-API.',
  })
  @IsOptional()
  @IsBoolean()
  passwordBlockLeaked?: boolean;

  @ApiPropertyOptional({
    description: 'Verhindert die Wiederverwendung der letzten 5 Passwörter.',
  })
  @IsOptional()
  @IsBoolean()
  passwordPreventReuseEnabled?: boolean;

  @ApiPropertyOptional({
    nullable: true,
    description:
      'Beendet eine Sitzung nach N Minuten Inaktivität, leer = kein Timeout.',
  })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsInt()
  @Min(1)
  sessionIdleTimeoutMinutes?: number | null;

  @ApiPropertyOptional({
    nullable: true,
    description: 'Hex-Akzentfarbe, leer = Standard-Markenfarbe.',
  })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @Matches(/^#[0-9a-fA-F]{6}$/)
  accentColor?: string | null;

  @ApiPropertyOptional({ enum: ['compact', 'normal', 'airy'] })
  @IsOptional()
  @IsIn(['compact', 'normal', 'airy'])
  tableDensity?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  sidebarCollapsedByDefault?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  keyboardShortcutsEnabled?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  reduceMotion?: boolean;

  // Einstellungen → Frontend (öffentliche Website, siehe
  // knowledge-base/frontend/taxonomy-management.md, Update 2026-08-31 –
  // Frontend/Backend-Begriffsklärung).
  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  siteTitle?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  siteTagline?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  faviconUrl?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  defaultSeoDescription?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  defaultOgImageUrl?: string | null;

  @ApiPropertyOptional({
    nullable: true,
    description:
      'Basis-URL der öffentlichen Webseite, z.B. https://www.strasev.de',
  })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsUrl({ require_tld: false })
  publicBaseUrl?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  mainNavigationId?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  footerNavigationPrimaryId?: string | null;

  @ApiPropertyOptional({
    description:
      'Prozessinterner Backend-Cache (CacheService). Aus = jede Abfrage geht direkt an die Datenbank.',
  })
  @IsOptional()
  @IsBoolean()
  backendCacheEnabled?: boolean;

  @ApiPropertyOptional({ minimum: 5, maximum: 3600 })
  @IsOptional()
  @IsInt()
  @Min(5)
  @Max(3600)
  backendCacheTtlSeconds?: number;

  @ApiPropertyOptional({
    description:
      'Zwischenspeicherung der API-Antworten in der öffentlichen Webseite (apps/site).',
  })
  @IsOptional()
  @IsBoolean()
  frontendCacheEnabled?: boolean;

  @ApiPropertyOptional({
    minimum: 60,
    maximum: 86400,
    description:
      'Mindestens 60 Sekunden: die Seiten selbst stehen auf revalidate = 60, ein kleinerer Wert bliebe wirkungslos.',
  })
  @IsOptional()
  @IsInt()
  @Min(60)
  @Max(86400)
  frontendCacheTtlSeconds?: number;

  // Globaler Abstand oben/unten aller Seiten der Webseite (Nutzervorgabe,
  // 2026-09-03). null/weglassen = kein globaler Wert; ein am Menüpunkt
  // gesetzter Wert sticht den globalen.
  @ApiPropertyOptional({ nullable: true, minimum: 0, maximum: 1000 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1000)
  pageSpacingTopMobile?: number | null;

  @ApiPropertyOptional({ nullable: true, minimum: 0, maximum: 1000 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1000)
  pageSpacingBottomMobile?: number | null;

  @ApiPropertyOptional({ nullable: true, minimum: 0, maximum: 1000 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1000)
  pageSpacingTopTablet?: number | null;

  @ApiPropertyOptional({ nullable: true, minimum: 0, maximum: 1000 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1000)
  pageSpacingBottomTablet?: number | null;

  @ApiPropertyOptional({ nullable: true, minimum: 0, maximum: 1000 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1000)
  pageSpacingTopDesktop?: number | null;

  @ApiPropertyOptional({ nullable: true, minimum: 0, maximum: 1000 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1000)
  pageSpacingBottomDesktop?: number | null;

  @ApiPropertyOptional({
    description:
      'Gilt der globale Abstand auch auf der Startseite? Ein am Startseiten-Menüpunkt gesetzter Wert bleibt davon unberührt.',
  })
  @IsOptional()
  @IsBoolean()
  pageSpacingOnHomepage?: boolean;

  // Werte der templateeigenen Einstellungen (Manifest des Frontends,
  // 2026-09-05). Bewusst als freies Objekt: welche Schlüssel es gibt,
  // weiß nur das Template. Geprüft wird gegen dessen Manifest, nicht
  // hier – die API kennt es nicht.
  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: true,
    description:
      'Werte der vom Frontend-Template deklarierten Einstellungen (Schlüssel = key aus dessen Manifest).',
  })
  @IsOptional()
  @IsObject()
  templateSettings?: Record<string, unknown>;

  // Hochgeladenes Manifest; sticht die Datei im Frontend-Projekt.
  // `null` setzt zurück auf diese Datei. Geprüft wird gegen das
  // Vokabular in der Verwaltung (validateTemplateManifest) – die API
  // kennt es nicht und würde sonst eine zweite, veraltende Prüfung
  // pflegen.
  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: true,
    nullable: true,
    description:
      'Hochgeladenes Template-Manifest; null = die Datei des Frontend-Projekts gilt.',
  })
  @IsOptional()
  @IsObject()
  templateManifest?: Record<string, unknown> | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  footerNavigationSecondaryId?: string | null;

  @ApiPropertyOptional({
    nullable: true,
    description:
      'Freie Zeile rechts in der Footer-Fußleiste der öffentlichen Webseite.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  footerNote?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  notifyMaintenanceMode?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  notifyStorageQuota?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  notifyWebhookFailures?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  notifyLocalDrafts?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  notifyPendingActivations?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  notifyFailedLogins?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  notifyPendingPasswordChanges?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  notifyCompanyIncomplete?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  notifyLegalDocuments?: boolean;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  companyLogoUrl?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  companyLogoUrlDark?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  companyName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  companyStreet?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  companyPostalCode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  companyCity?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  companyCountry?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  companyRepresentative?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  companyEmail?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  companyPhone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  companyRegisterCourt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  companyRegisterNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  companyVatId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  companySupervisoryAuthority?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  companyDisputeResolution?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  dpoIsExternal?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  dpoName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  dpoCompany?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  dpoEmail?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  dpoPhone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsISO8601()
  dpoAppointedAt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsISO8601()
  dpoReportedAt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  dpoSupervisoryAuthority?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsISO8601()
  dpoLastContactAt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  dpoListInLegalTexts?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  dpoNotifyOnIncident?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  dpoMonthlyReportEnabled?: boolean;

  @ApiPropertyOptional({
    nullable: true,
    description:
      'Aufbewahrung Formular-Einsendungen in Tagen, leer = unbegrenzt.',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  retentionFormSubmissionsDays?: number | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  retentionAccessLogMonths?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  retentionDeactivatedAccountsMonths?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  retentionTrashDays?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  dsbFormSelfServiceDisclosure?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  dsbFormStoreSubmissionIp?: boolean;

  // Einstellungen → Mailing → Reiter "Einsendungen" (Nutzervorgabe,
  // 2026-09-02).
  @ApiPropertyOptional({
    description:
      'Ob bei einer neuen Formular-Einsendung überhaupt eine Admin-Mail ' +
      'verschickt wird.',
  })
  @IsOptional()
  @IsBoolean()
  formSubmissionNotifyOnNew?: boolean;

  @ApiPropertyOptional({
    nullable: true,
    description:
      'Eigener Empfänger für Formular-Benachrichtigungen; leer = Rückfall ' +
      'auf notificationRecipientEmail. Ein am Formular gesetzter Empfänger ' +
      'hat weiterhin Vorrang.',
  })
  @IsOptional()
  @IsEmail()
  formSubmissionRecipientEmail?: string | null;

  @ApiPropertyOptional({
    description:
      'Vorbelegung von Form.sendConfirmation für NEU angelegte Formulare.',
  })
  @IsOptional()
  @IsBoolean()
  formSubmissionConfirmationDefault?: boolean;

  @ApiPropertyOptional({
    nullable: true,
    description:
      'Erinnerung, wenn Einsendungen so viele Tage ungelesen liegen; ' +
      'leer = keine Erinnerung.',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  formSubmissionUnreadReminderDays?: number | null;

  @ApiPropertyOptional({
    description: 'Systemmeldung für lange ungelesene Einsendungen.',
  })
  @IsOptional()
  @IsBoolean()
  notifyUnreadSubmissions?: boolean;

  @ApiPropertyOptional({
    nullable: true,
    description:
      'Tage nach dem Lesen bis zur endgültigen Löschung; leer = nie. ' +
      'Gehört fachlich zum Datenschutz-Modul (siehe UpdatePrivacyDto).',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  formSubmissionDeleteAfterReadDays?: number | null;

  @ApiPropertyOptional({
    nullable: true,
    description:
      'Tage ab EINGANG, nach denen eine nie gelesene Einsendung endgültig ' +
      'gelöscht wird; leer = nie. Bewusst großzügiger als die Lese-Frist.',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  formSubmissionDeleteUnreadAfterDays?: number | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  dsrAutoAcknowledgeReceipt?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  dsrDeadlineReminderEnabled?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  notifyDeletionRequests?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  notifyTrashExpiring?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  notifyWebsiteAnomaly?: boolean;

  // Schwellen der Zählerstand-Plausibilitätsprüfung (2026-09-01). Der
  // Prozentwert ist auf 1..99 begrenzt: 0 würde jede unveränderte Meldung
  // als Einbruch werten, 100 wäre nur bei einem Sturz auf exakt null
  // erfüllt. Der absolute Wert muss mindestens 1 sein.
  @ApiPropertyOptional({ minimum: 1, maximum: 99 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(99)
  statsAnomalyRelativeDropPercent?: number;

  @ApiPropertyOptional({ minimum: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  statsAnomalyAbsoluteDrop?: number;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  sccTemplateMediaId?: string | null;

  @ApiPropertyOptional({
    nullable: true,
    description:
      'Gemeinsame Empfänger-Adresse für alle Systembenachrichtigungen, leer = keine E-Mail-Zustellung.',
  })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsEmail()
  notificationRecipientEmail?: string | null;

  @ApiPropertyOptional({
    description: 'Pausiert alle nicht-kritischen geplanten Jobs.',
  })
  @IsOptional()
  @IsBoolean()
  jobsGloballyPaused?: boolean;

  // "Job-Lauf-Historie aufräumen" (Nutzervorgabe, 2026-08-30) – `null` =
  // unbegrenzt aufbewahren.
  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsInt()
  @Min(1)
  jobRunRetentionDays?: number | null;

  // "Aktivitäten-Historie aufräumen" (Nutzervorgabe, 2026-08-30) – `null` =
  // unbegrenzt aufbewahren.
  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsInt()
  @Min(1)
  activityLogRetentionDays?: number | null;
}
