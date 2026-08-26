import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString } from 'class-validator';

// Schritt 1 des Wiederherstellungs-Popups auf der Wartungsseite (siehe
// LicenseClientService.verifyRecoveryCredentials()) – bewusst kein echter
// Login-DTO, auch wenn die Felder identisch aussehen: die Antwort ist ein
// eng zweckgebundenes Token, kein Access-/Refresh-Token-Paar.
export class LicenseRecoveryVerifyDto {
  @ApiProperty({ example: 'admin@pivot.dev' })
  @IsEmail()
  email!: string;

  @ApiProperty()
  @IsString()
  password!: string;
}
