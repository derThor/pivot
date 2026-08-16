import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class ChangePasswordDto {
  @ApiProperty()
  @IsString()
  currentPassword!: string;

  @ApiProperty({
    description: 'Wird gegen die aktuelle Passwort-Policy geprüft.',
  })
  @IsString()
  @MinLength(1)
  newPassword!: string;
}
