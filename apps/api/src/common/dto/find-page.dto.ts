import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

/**
 * Query-Shape für "auf welcher Seite liegt Eintrag X" – von der globalen
 * Suche genutzt, um beim Klick auf einen Treffer direkt auf die richtige
 * Seite einer paginierten Listen-Ansicht zu springen.
 */
export class FindPageDto {
  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize: number = 20;
}
