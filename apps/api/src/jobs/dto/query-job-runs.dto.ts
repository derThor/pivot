import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';

// "Letzte Läufe"-Karte (Nutzervorgabe, 2026-08-22: "bei den letzte läufe
// pagination beachten") – gleiches Muster wie QuerySettingsChangesDto.
export class QueryJobRunsDto {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  // Reiter der "Letzte Läufe"-Karte (Nutzervorgabe, 2026-09-03).
  // Bewusst serverseitig gefiltert und nicht erst im Browser: die Karte
  // blättert, ein Filter über die aktuelle Seite hinweg würde eine
  // "Seite 2" zeigen, die auf einem anderen Ausschnitt beruht.
  //
  // Nur diese beiden Werte kommen vor (JobsService schreibt
  // 'success' | 'error'), ein dritter Reiter wäre immer leer.
  @ApiPropertyOptional({ enum: ['success', 'error'] })
  @IsOptional()
  @IsIn(['success', 'error'])
  status?: 'success' | 'error';

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize: number = 20;
}
