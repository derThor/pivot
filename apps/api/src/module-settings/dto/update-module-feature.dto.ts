import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

export class UpdateModuleFeatureDto {
  @ApiProperty()
  @IsBoolean()
  enabled!: boolean;
}
