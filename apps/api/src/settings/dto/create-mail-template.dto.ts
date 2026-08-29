import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

// "+ Neue Vorlage" (Nutzervorgabe, 2026-08-30: individuelle HTML-Vorlagen
// unter Einstellungen -> Mailing) – legt nur den Namen fest, Betreff/
// Inhalt/Hülle werden danach im normalen Vorlagen-Editor bearbeitet
// (PATCH /settings/mail-templates/:id), analog zu "+ Neue Hülle".
export class CreateMailTemplateDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  name: string;
}
