import { Module } from '@nestjs/common';
import { DataProcessorsService } from './data-processors.service';
import { DataProcessorsController } from './data-processors.controller';

@Module({
  controllers: [DataProcessorsController],
  providers: [DataProcessorsService],
})
export class DataProcessorsModule {}
