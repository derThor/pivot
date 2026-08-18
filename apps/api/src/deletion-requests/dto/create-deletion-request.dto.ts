import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsISO8601, IsIn, IsOptional, IsString, MinLength } from 'class-validator';

export const DELETION_REQUEST_STATUSES = [
  'open',
  'in_progress',
  'completed',
  'rejected',
] as const;

export class CreateDeletionRequestDto {
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

  @ApiPropertyOptional({ enum: DELETION_REQUEST_STATUSES })
  @IsOptional()
  @IsIn(DELETION_REQUEST_STATUSES)
  status?: (typeof DELETION_REQUEST_STATUSES)[number];

  @ApiPropertyOptional()
  @IsOptional()
  @IsISO8601()
  dueAt?: string;
}
