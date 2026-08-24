import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class LicenseCheckDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  domain!: string;
}
