import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MinLength } from 'class-validator';

export class CreateProcessingActivityDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  purpose!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  legalBasis?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  dataCategories?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  recipients?: string;
}
