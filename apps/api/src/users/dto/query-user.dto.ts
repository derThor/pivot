import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class QueryUserDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  roleId?: string;

  @ApiPropertyOptional({ description: 'Suche über Vor-/Nachname und E-Mail.' })
  @IsOptional()
  @IsString()
  q?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => value === 'true')
  @IsBoolean()
  isActive?: boolean;

  // Benutzer-Seite, Tab "Anonymisiert" (Nutzervorgabe, 2026-08-21): ohne
  // diesen Schalter sind anonymisierte Konten aus `findAll()` komplett
  // ausgeblendet (siehe dort) – hiermit lässt sich gezielt nur diese Menge
  // abfragen, statt sie unauffindbar zu machen.
  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => value === 'true')
  @IsBoolean()
  anonymized?: boolean;

  // Benutzer-Seite, Tab "Gelöscht" (Nutzervorgabe, 2026-08-21): analog zu
  // `anonymized` – ohne diesen Schalter sind gelöschte (aber noch nicht
  // anonymisierte) Konten aus `findAll()` ausgeblendet.
  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => value === 'true')
  @IsBoolean()
  deleted?: boolean;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize: number = 20;
}
