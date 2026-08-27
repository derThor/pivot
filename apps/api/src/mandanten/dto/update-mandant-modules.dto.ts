import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsString } from 'class-validator';

// Mandantenfähigkeit (Nutzervorgabe, 2026-08-27): ersetzt den kompletten
// Buchungsstand eines Mandanten – die Keys selbst werden serverseitig
// gegen den festen Modul-Katalog geprüft (siehe module-catalog.ts).
export class UpdateMandantModulesDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  @IsString({ each: true })
  moduleKeys!: string[];
}
