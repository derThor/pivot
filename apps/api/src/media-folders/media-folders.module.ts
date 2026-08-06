import { Module } from '@nestjs/common';
import { MediaFoldersService } from './media-folders.service';
import { MediaFoldersController } from './media-folders.controller';
import { MediaModule } from '../media/media.module';

@Module({
  imports: [MediaModule],
  controllers: [MediaFoldersController],
  providers: [MediaFoldersService],
})
export class MediaFoldersModule {}
