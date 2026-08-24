import { ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';
import { CreateWebsiteDto } from './create-website.dto';

export const WEBSITE_STATUSES = ['live', 'development', 'locked'] as const;

export const WEBSITE_DEPLOYMENT_MODES = ['master', 'slave'] as const;

export class UpdateWebsiteDto extends PartialType(CreateWebsiteDto) {
  @ApiPropertyOptional({ enum: WEBSITE_STATUSES })
  @IsOptional()
  @IsIn(WEBSITE_STATUSES)
  status?: (typeof WEBSITE_STATUSES)[number];

  @ApiPropertyOptional({ enum: WEBSITE_DEPLOYMENT_MODES })
  @IsOptional()
  @IsIn(WEBSITE_DEPLOYMENT_MODES)
  deploymentMode?: (typeof WEBSITE_DEPLOYMENT_MODES)[number];
}
