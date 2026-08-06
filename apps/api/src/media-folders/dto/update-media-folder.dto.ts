import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MinLength } from 'class-validator';

export class UpdateMediaFolderDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @ApiPropertyOptional({
    description:
      'Neuer Elternordner. Leerstring/`null` verschiebt den Ordner auf die Root-Ebene.',
  })
  @IsOptional()
  @IsString()
  parentId?: string | null;
}
