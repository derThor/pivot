import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, MinLength } from 'class-validator';

// "Jobs"-Reiter unter Einstellungen (Nutzervorgabe, 2026-08-22, 1:1 nach
// Bildvorlage "Geplante Aufgaben"). `cronExpression` wird serverseitig
// zusätzlich auf syntaktische Gültigkeit geprüft (siehe
// JobsService.assertValidCron) – class-validator prüft hier nur, dass
// überhaupt ein nicht-leerer String ankommt.
export class UpdateJobDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  cronExpression?: string;

  @ApiPropertyOptional({
    description:
      'Kritische Jobs lassen sich nicht pausieren (weder einzeln noch über den globalen Schalter).',
  })
  @IsOptional()
  @IsBoolean()
  isCritical?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isPaused?: boolean;

  @ApiPropertyOptional({
    description:
      'Mailt bei fehlgeschlagenem Lauf an den Benachrichtigungsempfänger (Einstellungen → Benachrichtigungen).',
  })
  @IsOptional()
  @IsBoolean()
  notifyOnFailure?: boolean;
}
