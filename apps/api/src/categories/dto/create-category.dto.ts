import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CategorySortOrder } from '@pivot/database';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';

export class CreateCategoryDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  name!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  slug!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @Matches(/^#[0-9a-fA-F]{6}$/)
  color?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  rssEnabled?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  archivePublished?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  showFeaturedLarge?: boolean;

  @ApiPropertyOptional({ enum: CategorySortOrder })
  @IsOptional()
  @IsEnum(CategorySortOrder)
  sortOrder?: CategorySortOrder;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsInt()
  @Min(1)
  postsPerPage?: number | null;
}
