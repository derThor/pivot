import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

// Alle Felder optional und ohne erzwungenen Default: fehlt `page`, liefert
// `findAll` weiterhin das flache Array wie bisher (siehe global-modules.service.ts)
// – für Stellen, die ALLE globalen Module brauchen (Block-Editor-Auflösung,
// Content-Vorschau/-Editor), nicht nur eine Seite davon. Erst wenn `page`
// explizit mitgeschickt wird (z.B. von der Galerien-/FAQ-Übersicht), wird
// paginiert und gefiltert.
export class QueryGlobalModuleDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  moduleTypeId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize: number = 20;
}
