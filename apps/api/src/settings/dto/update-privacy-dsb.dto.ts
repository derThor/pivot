import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEmail,
  IsISO8601,
  IsOptional,
  IsString,
} from 'class-validator';

// Datenschutz-als-Modul (Nutzervorgabe, 2026-08-28): eigene, engere DTO nur
// für den "Datenschutzbeauftragter"-Reiter, aus `UpdatePrivacyDto`
// herausgelöst, damit `PATCH /settings/privacy/dsb` unabhängig vom
// restlichen Datenschutz-Formular (Reiter "Rechtstexte") über
// `@RequireModuleFeature('datenschutz', 'dsb')` gegatet werden kann.
export class UpdatePrivacyDsbDto {
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
}
