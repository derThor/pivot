import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Min } from 'class-validator';

// Pixel-Rechteck relativ zur aktuell gespeicherten (bereits normalisierten)
// Bilddatei. Die eigentliche Prüfung gegen die tatsächlichen
// Bild-Dimensionen erfolgt im Service, da sie vom jeweiligen Medium abhängt.
export class CropMediaDto {
  @ApiProperty()
  @IsInt()
  @Min(0)
  x: number;

  @ApiProperty()
  @IsInt()
  @Min(0)
  y: number;

  @ApiProperty()
  @IsInt()
  @Min(1)
  width: number;

  @ApiProperty()
  @IsInt()
  @Min(1)
  height: number;
}
