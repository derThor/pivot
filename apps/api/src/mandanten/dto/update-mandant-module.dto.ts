import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

export class UpdateMandantModuleDto {
  @ApiProperty()
  @IsBoolean()
  enabled!: boolean;
}
