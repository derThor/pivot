import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

// Schritt 2 des Wiederherstellungs-Popups auf der Wartungsseite (siehe
// LicenseClientService.applyRecoveryKey()) – `recoveryToken` stammt aus
// Schritt 1, wird ohne gültiges Token vom Service abgelehnt.
export class LicenseRecoveryApplyKeyDto {
  @ApiProperty()
  @IsString()
  recoveryToken!: string;

  @ApiProperty()
  @IsString()
  apiKey!: string;
}
