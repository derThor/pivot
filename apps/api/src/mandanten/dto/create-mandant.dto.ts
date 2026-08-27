import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches, MaxLength, MinLength } from 'class-validator';

// Mandantenfähigkeit (Nutzervorgabe, 2026-08-27): "bei den Mandanten
// gehört immer eine Webseite oder mehrere dazu" – ein Mandant entsteht
// deshalb immer zusammen mit seiner ersten Website, nie leer.
export class CreateMandantDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;

  @ApiProperty()
  @IsString()
  @MaxLength(255)
  @Matches(
    /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/i,
    {
      message: 'domain muss eine gültige Domain sein (z.B. strasev.de).',
    },
  )
  domain!: string;
}
