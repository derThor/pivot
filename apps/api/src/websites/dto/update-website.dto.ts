import { ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsIn, IsOptional, IsUrl, MaxLength } from 'class-validator';
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

  // Nur für lokale/Test-Installationen (siehe schema.prisma-Kommentar) –
  // `require_tld: false` erlaubt `http://localhost:3010`.
  @ApiPropertyOptional()
  @IsOptional()
  @MaxLength(255)
  @IsUrl({ require_tld: false, protocols: ['http', 'https'] })
  testUrl?: string | null;
}
