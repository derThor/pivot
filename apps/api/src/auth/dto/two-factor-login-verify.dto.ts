import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class TwoFactorLoginVerifyDto {
  @ApiProperty({
    description: 'Challenge-Token aus der mfaRequired-Antwort von /auth/login.',
  })
  @IsString()
  challengeToken!: string;

  @ApiProperty({
    description:
      '6-stelliger TOTP-Code oder ein einzelner, noch nicht verbrauchter Recovery-Code.',
  })
  @IsString()
  code!: string;
}
