import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

// "Geplante Aufgaben"-Karte (Nutzervorgabe, 2026-08-22: "bei geplante
// aufgaben auch pagination beachten") – gleiches Muster wie
// QueryJobRunsDto/QuerySettingsChangesDto. Aktuell nur 3 Jobs, daher in
// der Praxis immer eine Seite – zukunftssicher für weitere Jobs.
export class QueryJobsDto {
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
