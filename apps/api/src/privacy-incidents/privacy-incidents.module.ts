import { Module } from '@nestjs/common';
import { PrivacyIncidentsService } from './privacy-incidents.service';
import { PrivacyIncidentsController } from './privacy-incidents.controller';
import { SettingsModule } from '../settings/settings.module';
import { MailerModule } from '../mailer/mailer.module';
import { LicenseClientModule } from '../license-client/license-client.module';

@Module({
  imports: [SettingsModule, MailerModule, LicenseClientModule],
  controllers: [PrivacyIncidentsController],
  providers: [PrivacyIncidentsService],
})
export class PrivacyIncidentsModule {}
