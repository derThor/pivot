import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

export class CreateRoleDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    description:
      'Ob Benutzer mit dieser Rolle das Verwaltungs-Dashboard öffnen dürfen. Standard: true.',
  })
  @IsOptional()
  @IsBoolean()
  canAccessDashboard?: boolean;

  @ApiProperty({
    type: [String],
    description: 'Liste von "resource:action"-Strings, z.B. "content:create".',
  })
  @IsArray()
  @IsString({ each: true })
  permissions!: string[];
}
