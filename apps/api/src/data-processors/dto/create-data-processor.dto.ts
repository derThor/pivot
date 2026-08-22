import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEmail,
  IsISO8601,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

export class CreateDataProcessorDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  purpose?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  hasContract?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsISO8601()
  contractDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  contractMediaId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  location?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  complianceNote?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  outsideEu?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  contactEmail?: string;
}
