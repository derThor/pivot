import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, Min, MinLength } from 'class-validator';

const SEARCH_RESULT_TYPES = [
  'content',
  'category',
  'tag',
  'media',
  'user',
  'role',
  'previewLink',
  'faq',
  'gallery',
] as const;

export class PagedSearchDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  q!: string;

  @ApiProperty({ enum: SEARCH_RESULT_TYPES })
  @IsIn(SEARCH_RESULT_TYPES)
  type!: (typeof SEARCH_RESULT_TYPES)[number];

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize: number = 20;
}
