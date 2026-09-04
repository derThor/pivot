import { ApiProperty } from '@nestjs/swagger';
import { IsObject } from 'class-validator';

export class SaveTemplateRegionDto {
  /**
   * Bausteine des Bereichs, gleiche Form wie `Content.data`
   * (`{ blocks: ModuleInstance[] }`).
   *
   * Bewusst nur als Objekt geprüft und nicht Feld für Feld: die Form der
   * Bausteine bestimmt der jeweilige Modul-Typ (dessen Schema in der
   * Datenbank steht), nicht dieses DTO. Genauso wird `Content.data`
   * behandelt.
   */
  @ApiProperty({ type: 'object', additionalProperties: true })
  @IsObject()
  data!: Record<string, unknown>;
}
