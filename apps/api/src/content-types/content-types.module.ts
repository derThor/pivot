import { Module } from '@nestjs/common';
import { ContentTypesService } from './content-types.service';
import { ContentTypesController } from './content-types.controller';

@Module({
  controllers: [ContentTypesController],
  providers: [ContentTypesService],
})
export class ContentTypesModule {}
