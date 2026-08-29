import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

// "+ Neue Hülle" (Nutzervorgabe, 2026-08-30: "mache mehrere Hüllen für
// eine Installation möglich") – legt nur den Namen fest, der Inhalt wird
// danach im Hüllen-Editor bearbeitet (PATCH /settings/mail-shells/:id).
export class CreateMailShellDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  name: string;
}
