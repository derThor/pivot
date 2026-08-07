import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class UpdatePreviewLinkDto {
  @ApiPropertyOptional({
    description:
      'Neue Gültigkeitsdauer in Stunden, gerechnet ab jetzt (Default 168 = 7 Tage).',
    default: 168,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(720)
  expiresInHours: number = 168;
}
