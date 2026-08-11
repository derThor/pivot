import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min, MinLength } from 'class-validator';

export class GlobalSearchDto {
  @ApiPropertyOptional()
  @IsString()
  @MinLength(1)
  q!: string;

  // Max 50 statt vorher 20: die Dropdown-/Command-Palette-Vorschau fragt
  // weiterhin nur 5-8 an, die Detailsuche-Ergebnisseite (siehe
  // dashboard/search) braucht aber mehr Treffer pro Bereich als die reine
  // "Top N"-Vorschau.
  @ApiPropertyOptional({ default: 5 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit: number = 5;
}
