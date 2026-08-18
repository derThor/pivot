import { Module } from '@nestjs/common';
import { ProcessingActivitiesService } from './processing-activities.service';
import { ProcessingActivitiesController } from './processing-activities.controller';

@Module({
  controllers: [ProcessingActivitiesController],
  providers: [ProcessingActivitiesService],
})
export class ProcessingActivitiesModule {}
