import { Module } from '@nestjs/common';
import { PublicContentService } from './public-content.service';
import { PublicContentController } from './public-content.controller';

@Module({
  controllers: [PublicContentController],
  providers: [PublicContentService],
})
export class PublicContentModule {}
