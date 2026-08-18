import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length } from 'class-validator';

export class TwoFactorVerifyDto {
  @ApiProperty({ description: '6-stelliger Code aus der Authenticator-App.' })
  @IsString()
  @Length(6, 6)
  code!: string;
}
