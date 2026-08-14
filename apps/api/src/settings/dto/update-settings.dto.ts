import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class UpdateSettingsDto {
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

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  defaultPageSize?: number;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  companyLogoUrl?: string | null;

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
}
