import { Module } from '@nestjs/common';
import { ContentService } from './content.service';
import { ContentController } from './content.controller';
import { ContentSchedulerService } from './content-scheduler.service';
import { WebhooksModule } from '../webhooks/webhooks.module';

@Module({
  imports: [WebhooksModule],
  controllers: [ContentController],
  providers: [ContentService, ContentSchedulerService],
  exports: [ContentService],
})
export class ContentModule {}
