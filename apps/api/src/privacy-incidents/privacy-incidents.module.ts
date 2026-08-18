import { Module } from '@nestjs/common';
import { PrivacyIncidentsService } from './privacy-incidents.service';
import { PrivacyIncidentsController } from './privacy-incidents.controller';
import { SettingsModule } from '../settings/settings.module';
import { MailerModule } from '../mailer/mailer.module';

@Module({
  imports: [SettingsModule, MailerModule],
  controllers: [PrivacyIncidentsController],
  providers: [PrivacyIncidentsService],
})
export class PrivacyIncidentsModule {}
