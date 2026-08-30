import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  Matches,
  Max,
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
}
