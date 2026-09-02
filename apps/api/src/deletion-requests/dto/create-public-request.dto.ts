import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, MaxLength } from 'class-validator';

/** Auskunftsanfrage aus dem Formular-Footer der öffentlichen Website
 * (Nutzervorgabe, 2026-09-02). Bewusst nur zwei Felder: mehr braucht es
 * nicht, um die Anfrage aufzunehmen, und jedes weitere Pflichtfeld wäre
 * eine Hürde für ein Recht, das ohne Hürden ausgeübt werden können soll. */
export class CreatePublicRequestDto {
  @ApiProperty({ description: 'E-Mail-Adresse der anfragenden Person.' })
  @IsEmail()
  email!: string;

  @ApiPropertyOptional({
    description: 'Optionale Anmerkung, worum es geht.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string;
}
