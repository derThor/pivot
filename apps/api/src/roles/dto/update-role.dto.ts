import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

export class UpdateRoleDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    description:
      'Ob Benutzer mit dieser Rolle das Verwaltungs-Dashboard öffnen dürfen.',
  })
  @IsOptional()
  @IsBoolean()
  canAccessDashboard?: boolean;

  @ApiPropertyOptional({
    type: [String],
    description: 'Liste von "resource:action"-Strings, ersetzt die bisherigen Rechte.',
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  permissions?: string[];
}
