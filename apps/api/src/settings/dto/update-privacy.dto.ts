import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsOptional, Min } from 'class-validator';

// Nur die Datenschutz-relevanten Felder (DSB-Kontakt, Aufbewahrungsfristen,
// Formular-Einstellungen, SCC-Vorlage) – analog zu UpdateCompanyDto: eine
// eigene, engere DTO statt PartialType(UpdateSettingsDto), damit
// `PATCH /settings/privacy` (Recht `privacy:update`) technisch gar nicht
// erst globale System-Einstellungen annehmen kann (Nutzer-Bugreport,
// 2026-08-21: "warum habe ich als admin keine datenschutz zugriffsrechte,
// obwohl die rolle vergeben ist" – die Datenschutz-Seite lud bisher über
// den allgemeinen `settings:read`-Endpoint, den Administrator seit der
// Pivot-Einführung nicht mehr hat, obwohl `privacy:read` vollständig
// vorhanden ist).
export class UpdatePrivacyDto {
  @ApiPropertyOptional({ nullable: true })
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
}
