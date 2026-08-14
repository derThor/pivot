import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsIn,
  IsISO8601,
  IsObject,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import { ContentStatus } from '@pivot/database';

export class CreateContentDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  title!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  slug!: string;

  @ApiProperty()
  @IsString()
  contentTypeId!: string;

  @ApiProperty({ type: 'object', additionalProperties: true })
  @IsObject()
  data!: Record<string, unknown>;

  @ApiPropertyOptional({ enum: ContentStatus })
  @IsOptional()
  @IsEnum(ContentStatus)
  status?: ContentStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  locale?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  excerpt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  seoTitle?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  seoDescription?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  canonicalUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  ogTitle?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  ogDescription?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  ogImageUrl?: string;

  @ApiPropertyOptional({ enum: ['summary', 'summary_large_image'], nullable: true })
  @IsOptional()
  @IsIn(['summary', 'summary_large_image'])
  twitterCard?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  robotsIndex?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  robotsFollow?: boolean;

  @ApiPropertyOptional({
    description: 'ISO-8601-Zeitpunkt, erforderlich wenn status=SCHEDULED.',
    nullable: true,
  })
  @IsOptional()
  @IsISO8601()
  scheduledFor?: string | null;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  categoryIds?: string[];
}
