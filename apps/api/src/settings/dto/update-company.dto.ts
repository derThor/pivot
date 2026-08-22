import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

// Nur die Firma-Stammdaten (siehe `COMPANY_FIELD_KEYS` in
// settings.service.ts) – bewusst eine eigene, engere DTO statt
// `PartialType(UpdateSettingsDto)`, damit `PATCH /settings/company`
// (Recht `company:update`) technisch gar nicht erst andere, globale
// Einstellungsfelder annehmen kann, selbst wenn jemand sie im Body
// mitschickt (Nutzervorgabe, 2026-08-21: "admin soll aber firma sehen
// können" – Firma bewusst von den echten Einstellungen getrennt).
export class UpdateCompanyDto {
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
}
