import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsISO8601,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from 'class-validator';

export const DELETION_REQUEST_STATUSES = [
  'open',
  'in_progress',
  'completed',
  'rejected',
] as const;

// Trotz Dateiname nicht mehr nur Löschungen – deckt alle drei DSGVO-
// Anfragearten ab (Nutzervorgabe, 2026-08-19, Löschanfragen-Neugestaltung).
export const DATA_SUBJECT_REQUEST_TYPES = [
  'deletion',
  'access',
  'rectification',
] as const;

export class CreateDeletionRequestDto {
  @ApiPropertyOptional({ enum: DATA_SUBJECT_REQUEST_TYPES })
  @IsOptional()
  @IsIn(DATA_SUBJECT_REQUEST_TYPES)
  type?: (typeof DATA_SUBJECT_REQUEST_TYPES)[number];

  @ApiProperty()
  @IsString()
  @MinLength(1)
  requesterName!: string;

  @ApiProperty()
  @IsEmail()
  requesterEmail!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reason?: string;

  @ApiPropertyOptional({
    description: 'Woher die Anfrage kam, z.B. Formular „Kontaktanfrage“.',
  })
  @IsOptional()
  @IsString()
  source?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  affectedRecordsCount?: number;

  @ApiPropertyOptional({ enum: DELETION_REQUEST_STATUSES })
  @IsOptional()
  @IsIn(DELETION_REQUEST_STATUSES)
  status?: (typeof DELETION_REQUEST_STATUSES)[number];

  @ApiPropertyOptional()
  @IsOptional()
  @IsISO8601()
  dueAt?: string;
}
