import { Module } from '@nestjs/common';
import { TemplateRegionsController } from './template-regions.controller';
import { TemplateRegionsService } from './template-regions.service';
import { SiteCacheModule } from '../site-cache/site-cache.module';

@Module({
  imports: [SiteCacheModule],
  controllers: [TemplateRegionsController],
  providers: [TemplateRegionsService],
  exports: [TemplateRegionsService],
})
export class TemplateRegionsModule {}
