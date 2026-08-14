import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength } from 'class-validator';

export class RegisterDto {
  @ApiProperty({ example: 'user@pivot.dev' })
  @IsEmail()
  email!: string;

  @ApiProperty({ description: 'Wird gegen die aktuelle Passwort-Policy geprüft.' })
  @IsString()
  @MinLength(1)
  password!: string;

  @ApiProperty({ example: 'Max' })
  @IsString()
  @MinLength(1)
  firstName!: string;

  @ApiProperty({ example: 'Mustermann' })
  @IsString()
  @MinLength(1)
  lastName!: string;
}
