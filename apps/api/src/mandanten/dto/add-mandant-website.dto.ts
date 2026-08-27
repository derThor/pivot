import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches, MaxLength } from 'class-validator';

// "Domain hinzufügen" auf der Mandant-Detailseite – Name wird aus der
// Domain abgeleitet (kein eigenes Namensfeld, hält das Formular schlank).
export class AddMandantWebsiteDto {
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
