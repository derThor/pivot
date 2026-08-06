import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

export class RegisterDto {
  @ApiProperty({ example: 'user@strasev.dev' })
  @IsEmail()
  email!: string;

  @ApiProperty({ description: 'Wird gegen die aktuelle Passwort-Policy geprüft.' })
  @IsString()
  @MinLength(1)
  password!: string;

  @ApiPropertyOptional({ example: 'Max' })
  @IsOptional()
  @IsString()
  firstName?: string;

  @ApiProperty({ example: 'Mustermann' })
  @IsString()
  @MinLength(1)
  lastName!: string;
}
