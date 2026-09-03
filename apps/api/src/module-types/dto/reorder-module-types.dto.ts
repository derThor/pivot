import { ApiProperty } from '@nestjs/swagger';
import { ArrayNotEmpty, IsArray, IsString } from 'class-validator';

/**
 * Neue Reihenfolge der Baustein-Palette (Nutzervorgabe, 2026-09-03).
 * Bewusst die VOLLSTÄNDIGE Liste der Ids in der gewünschten Reihenfolge
 * und nicht "verschiebe X hinter Y": so gibt es keinen Zwischenzustand,
 * in dem zwei Bausteine dieselbe Position hätten, und der Server muss
 * nichts nachrechnen.
 */
export class ReorderModuleTypesDto {
  @ApiProperty({ type: [String], description: 'Ids in der neuen Reihenfolge.' })
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  ids!: string[];
}
