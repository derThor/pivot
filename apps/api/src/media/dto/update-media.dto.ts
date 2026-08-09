import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

export class UpdateMediaDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  alt?: string;

  @ApiPropertyOptional({
    description:
      'Ziel-Ordner zum Verschieben. Leerstring/`null` verschiebt auf die Root-Ebene.',
  })
  @IsOptional()
  @IsString()
  folderId?: string | null;

  @ApiPropertyOptional({
    description:
      'Fokuspunkt X, normiert 0–1 (0 = linker Rand, 1 = rechter Rand). Fließt in künftig generierte Zuschnitte/Varianten ein.',
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  focalX?: number;

  @ApiPropertyOptional({
    description: 'Fokuspunkt Y, normiert 0–1 (0 = oberer Rand, 1 = unterer Rand).',
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  focalY?: number;

  @ApiPropertyOptional({
    type: [String],
    description: 'Ersetzt die vollständige Tag-Zuordnung dieses Mediums.',
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tagIds?: string[];
}
