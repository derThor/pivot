import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsObject, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateGlobalModuleDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  name!: string;

  @ApiProperty()
  @IsString()
  moduleTypeId!: string;

  @ApiProperty({ type: 'object', additionalProperties: true })
  @IsObject()
  values!: Record<string, unknown>;

  // Anzeige-Einstellungen der Instanz (z.B. Swiper-Konfiguration bei
  // Galerien) – optional, da nicht jeder Modul-Typ solche Einstellungen
  // braucht (siehe GlobalModule.settings in schema.prisma).
  @ApiPropertyOptional({ type: 'object', additionalProperties: true })
  @IsOptional()
  @IsObject()
  settings?: Record<string, unknown>;
}
