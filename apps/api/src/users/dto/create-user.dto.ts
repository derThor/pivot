import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsEmail,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

export class CreateUserDto {
  @ApiProperty()
  @IsEmail()
  email!: string;

  @ApiProperty({
    description: 'Wird gegen die aktuelle Passwort-Policy geprüft.',
  })
  @IsString()
  @MinLength(1)
  password!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  firstName?: string;

  @ApiProperty()
  @IsString()
  lastName!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  department?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({
    description: 'Fehlt dieses Feld, wird die Standardrolle zugewiesen.',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  roleIds?: string[];
}
