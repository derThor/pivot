import { Module } from '@nestjs/common';
import { WebsitesService } from './websites.service';
import { WebsitesController } from './websites.controller';
import { LicenseController } from './license.controller';
import { MasterOnlyGuard } from './master-only.guard';
import { WebsiteMonitorService } from './website-monitor.service';

@Module({
  controllers: [WebsitesController, LicenseController],
  providers: [WebsitesService, MasterOnlyGuard, WebsiteMonitorService],
  exports: [WebsitesService, MasterOnlyGuard],
})
export class WebsitesModule {}
