import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsObject, IsOptional, IsString, MinLength } from 'class-validator';

export class UpdateFrontendTemplateDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  /** Das Manifest wird gegen das Vokabular in der VERWALTUNG geprüft
   * (validateTemplateManifest) – die API kennt es nicht und würde sonst
   * eine zweite, veraltende Prüfung pflegen. Gleiche Aufteilung wie beim
   * hinterlegten Manifest in den Einstellungen. */
  @ApiPropertyOptional({ type: 'object', additionalProperties: true })
  @IsOptional()
  @IsObject()
  manifest?: Record<string, unknown>;
}
