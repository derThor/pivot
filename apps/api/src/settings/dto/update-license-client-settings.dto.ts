import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

// Einstellungen → Master-Client, Feld "API-Key" (Nutzervorgabe, 2026-08-24).
// Eigene DTO statt Erweiterung von UpdateSettingsDto, da `apiKey` ein
// Schreib-only-Feld ist (leer lassen = bestehenden Key behalten, siehe
// SettingsService.updateLicenseClientSettings) und nie im GET-Response
// auftaucht – gleiches Muster wie UpdateSmtpSettingsDto.password.
export class UpdateLicenseClientSettingsDto {
  @ApiPropertyOptional({
    description: 'Leer lassen, um den bestehenden Key zu behalten.',
  })
  @IsOptional()
  @IsString()
  apiKey?: string;
}
