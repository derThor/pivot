import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class UpdateLegalDocumentDto {
  @ApiPropertyOptional({
    description:
      'Manuelle Ergänzung, bleibt bei "Neu erzeugen" erhalten und wird nicht überschrieben.',
  })
  @IsOptional()
  @IsString()
  manualAddendum?: string | null;
}
