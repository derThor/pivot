import { Module } from '@nestjs/common';
import { MediaService } from './media.service';
import { MediaController } from './media.controller';
import { MediaImageProcessingService } from './media-image-processing.service';

@Module({
  controllers: [MediaController],
  providers: [MediaService, MediaImageProcessingService],
  exports: [MediaService],
})
export class MediaModule {}
