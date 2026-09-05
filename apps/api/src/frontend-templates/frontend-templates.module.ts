import { Module } from '@nestjs/common';

import { FrontendTemplatesController } from './frontend-templates.controller';
import { FrontendTemplatesService } from './frontend-templates.service';
import { SiteCacheModule } from '../site-cache/site-cache.module';

@Module({
  imports: [SiteCacheModule],
  controllers: [FrontendTemplatesController],
  providers: [FrontendTemplatesService],
  exports: [FrontendTemplatesService],
})
export class FrontendTemplatesModule {}
