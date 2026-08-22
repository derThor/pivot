import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class SendFollowUpDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  message!: string;
}
