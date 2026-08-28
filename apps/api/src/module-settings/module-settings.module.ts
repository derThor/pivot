import { Module } from '@nestjs/common';
import { ModuleSettingsController } from './module-settings.controller';
import { ModuleSettingsService } from './module-settings.service';
import { WebsitesModule } from '../websites/websites.module';

@Module({
  // `WebsitesModule` exportiert `MasterOnlyGuard` – gleiches Muster wie
  // `MandantenModule`.
  imports: [WebsitesModule],
  controllers: [ModuleSettingsController],
  providers: [ModuleSettingsService],
})
export class ModuleSettingsModule {}
