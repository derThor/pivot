import { Module } from '@nestjs/common';
import { CompanyLocationsService } from './company-locations.service';
import { CompanyLocationsController } from './company-locations.controller';

@Module({
  controllers: [CompanyLocationsController],
  providers: [CompanyLocationsService],
})
export class CompanyLocationsModule {}
