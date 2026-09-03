import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString } from 'class-validator';

/**
 * Gemeinsames Query-Shape für sortierbare Listen (Nutzervorgabe,
 * 2026-09-03: "eine Sortierfunktion in allen Listen"). Vorher legte jede
 * Liste ihre Reihenfolge fest im Service an – 15-mal derselbe Code mit 15
 * verschiedenen Feldnamen.
 *
 * `sortBy` ist bewusst ein freier String und wird NICHT hier validiert:
 * welche Felder erlaubt sind, weiß nur die jeweilige Liste. Die Prüfung
 * passiert deshalb im Service über eine Positivliste (siehe
 * `resolveOrderBy()`), und ein unbekannter Wert fällt still auf die
 * Standard-Reihenfolge zurück – eine von Hand verbogene URL soll keinen
 * Fehler erzeugen, sondern die gewohnte Liste.
 */
export class SortQueryDto {
  @ApiPropertyOptional({
    description:
      'Feldname aus der Positivliste der jeweiligen Liste. Unbekannte Werte werden ignoriert.',
  })
  @IsOptional()
  @IsString()
  sortBy?: string;

  @ApiPropertyOptional({ enum: ['asc', 'desc'] })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortDir?: 'asc' | 'desc';
}
