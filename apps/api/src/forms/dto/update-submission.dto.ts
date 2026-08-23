import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

export class UpdateSubmissionDto {
  @ApiProperty()
  @IsBoolean()
  isRead!: boolean;
}
