import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsIn,
  IsOptional,
  IsUrl,
} from 'class-validator';

export const WEBHOOK_EVENTS = [
  'content.published',
  'content.updated',
] as const;

export class CreateWebhookDto {
  @ApiProperty()
  @IsUrl({ require_tld: false })
  url!: string;

  @ApiProperty({ enum: WEBHOOK_EVENTS, isArray: true })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique()
  @IsIn(WEBHOOK_EVENTS, { each: true })
  events!: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
