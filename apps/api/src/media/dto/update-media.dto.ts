import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class UpdateMediaDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  alt?: string;

  @ApiPropertyOptional({
    description:
      'Ziel-Ordner zum Verschieben. Leerstring/`null` verschiebt auf die Root-Ebene.',
  })
  @IsOptional()
  @IsString()
  folderId?: string | null;
}
