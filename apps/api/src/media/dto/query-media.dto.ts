import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import type { MediaCategory } from '../media.config';

const MEDIA_CATEGORIES: MediaCategory[] = ['image', 'pdf', 'video', 'office', 'other'];

export class QueryMediaDto {
  @ApiPropertyOptional({
    description:
      'Ordner-ID zum Filtern. Literal "root" filtert auf Medien ohne Ordner. Weggelassen = alle Medien, ordnerübergreifend.',
  })
  @IsOptional()
  @IsString()
  folderId?: string;

  @ApiPropertyOptional({ enum: MEDIA_CATEGORIES, description: 'Dateityp-Kategorie' })
  @IsOptional()
  @IsIn(MEDIA_CATEGORIES)
  type?: MediaCategory;

  @ApiPropertyOptional({ description: 'Mindestgröße in Bytes' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  minSize?: number;

  @ApiPropertyOptional({ description: 'Maximalgröße in Bytes' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  maxSize?: number;

  @ApiPropertyOptional({ description: 'Kommagetrennte Tag-IDs' })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.split(',').filter(Boolean) : value))
  tagIds?: string[];

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @ApiPropertyOptional({ default: 24 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize: number = 24;
}
