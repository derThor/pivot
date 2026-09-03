import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { SortQueryDto } from '../../common/dto/sort-query.dto';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { CategorySortOrder, ContentStatus } from '@pivot/database';

export class QueryContentDto extends SortQueryDto {
  @ApiPropertyOptional({ enum: ContentStatus })
  @IsOptional()
  @IsEnum(ContentStatus)
  status?: ContentStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  contentTypeId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  categoryId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;

  // Kategorien-Seite, "Sortierung" (Nutzervorgabe, 2026-08-31) – wirkt nur
  // in Kombination mit `categoryId`, siehe ContentService.findAll().
  @ApiPropertyOptional({ enum: CategorySortOrder })
  @IsOptional()
  @IsEnum(CategorySortOrder)
  sortOrder?: CategorySortOrder;

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
