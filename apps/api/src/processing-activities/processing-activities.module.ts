import { Module } from '@nestjs/common';
import { ProcessingActivitiesService } from './processing-activities.service';
import { ProcessingActivitiesController } from './processing-activities.controller';
import { LicenseClientModule } from '../license-client/license-client.module';

@Module({
  imports: [LicenseClientModule],
  controllers: [ProcessingActivitiesController],
  providers: [ProcessingActivitiesService],
})
export class ProcessingActivitiesModule {}
