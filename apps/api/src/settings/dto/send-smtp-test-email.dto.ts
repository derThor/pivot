import { ApiProperty } from '@nestjs/swagger';
import { IsEmail } from 'class-validator';

// "Testmail senden" im SMTP-Einrichten-Dialog (Nutzer-Bugreport,
// 2026-08-22: "ich habe die testmail versendet, bekomme sie nicht" – die
// Mail ging an die im Pivot-Konto hinterlegte Adresse, nicht an eine
// echte, vom Nutzer kontrollierte Adresse). Zieladresse kommt jetzt aus
// dem Dialog statt automatisch aus dem JWT.
export class SendSmtpTestEmailDto {
  @ApiProperty()
  @IsEmail()
  to: string;
}
