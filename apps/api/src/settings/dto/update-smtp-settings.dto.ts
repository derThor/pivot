import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateIf,
} from 'class-validator';

// Einstellungen → Integrationen, Karte "Dienste" (Nutzervorgabe,
// 2026-08-22: "email versand bauen ... als dienst"). Eigene DTO statt
// Erweiterung von UpdateSettingsDto, da `password` ein Schreib-only-Feld
// ist (leer lassen = bestehendes Passwort behalten, siehe
// SettingsService.updateSmtpSettings) und nie im GET-Response auftaucht.
export class UpdateSmtpSettingsDto {
  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  host?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsInt()
  @Min(1)
  @Max(65535)
  port?: number | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  username?: string | null;

  @ApiPropertyOptional({
    description: 'Leer lassen, um das bestehende Passwort zu behalten.',
  })
  @IsOptional()
  @IsString()
  password?: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsEmail()
  fromAddress?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  fromName?: string | null;

  @ApiPropertyOptional({ enum: ['none', 'starttls', 'ssl'] })
  @IsOptional()
  @IsIn(['none', 'starttls', 'ssl'])
  secure?: string;
}
