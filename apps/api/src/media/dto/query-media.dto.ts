import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import type { MediaCategory } from '../media.config';

const MEDIA_CATEGORIES: MediaCategory[] = ['image', 'pdf', 'video', 'office', 'other'];
// "document" ist keine echte `MediaCategory` (siehe media.config.ts),
// sondern ein reines Filter-Pseudo-Typ fürs Frontend: fasst PDF + Office
// zu einer gemeinsamen "Dokumente"-Pille zusammen (Nutzervorgabe,
// 2026-08-15, 1:1 nach Bildvorlage) – MediaService#findAll löst ihn in
// beide echten Kategorien auf.
const QUERY_TYPES = [...MEDIA_CATEGORIES, 'document'] as const;
type QueryMediaType = (typeof QUERY_TYPES)[number];

export class QueryMediaDto {
  @ApiPropertyOptional({
    description:
      'Ordner-ID zum Filtern. Literal "root" filtert auf Medien ohne Ordner. Weggelassen = alle Medien, ordnerübergreifend.',
  })
  @IsOptional()
  @IsString()
  folderId?: string;

  @ApiPropertyOptional({ enum: QUERY_TYPES, description: 'Dateityp-Kategorie' })
  @IsOptional()
  @IsIn(QUERY_TYPES)
  type?: QueryMediaType;

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
