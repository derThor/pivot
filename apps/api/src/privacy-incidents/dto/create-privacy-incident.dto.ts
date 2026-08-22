import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsISO8601,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from 'class-validator';

export const PRIVACY_INCIDENT_SEVERITIES = ['low', 'medium', 'high'] as const;
export const PRIVACY_INCIDENT_STATUSES = ['open', 'resolved'] as const;

export class CreatePrivacyIncidentDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  title!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ enum: PRIVACY_INCIDENT_SEVERITIES })
  @IsOptional()
  @IsIn(PRIVACY_INCIDENT_SEVERITIES)
  severity?: (typeof PRIVACY_INCIDENT_SEVERITIES)[number];

  @ApiPropertyOptional({ enum: PRIVACY_INCIDENT_STATUSES })
  @IsOptional()
  @IsIn(PRIVACY_INCIDENT_STATUSES)
  status?: (typeof PRIVACY_INCIDENT_STATUSES)[number];

  @ApiPropertyOptional()
  @IsOptional()
  @IsISO8601()
  occurredAt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  affectedCount?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  measuresDocumented?: string;
}
