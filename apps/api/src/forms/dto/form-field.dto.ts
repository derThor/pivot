import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
} from 'class-validator';
import { FORM_FIELD_TYPES, type FormFieldType } from '../form-field.types';

export class FormFieldDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  id!: string;

  @ApiProperty({ enum: FORM_FIELD_TYPES })
  @IsIn(FORM_FIELD_TYPES)
  type!: FormFieldType;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  label!: string;

  @ApiProperty()
  @IsBoolean()
  required!: boolean;

  @ApiProperty({ minimum: 10, maximum: 100 })
  @IsInt()
  @Min(10)
  @Max(100)
  width!: number;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  options?: string[];

  @ApiPropertyOptional({ enum: ['vertical', 'horizontal'] })
  @IsOptional()
  @IsIn(['vertical', 'horizontal'])
  optionsLayout?: 'vertical' | 'horizontal';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  helpText?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  showLabel?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  privacyPageSlug?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  privacyPageTitle?: string;
}
