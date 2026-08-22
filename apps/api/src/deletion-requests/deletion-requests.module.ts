import { Module } from '@nestjs/common';
import { DeletionRequestsService } from './deletion-requests.service';
import { DeletionRequestsController } from './deletion-requests.controller';
import { DeletionRequestReminderSchedulerService } from './deletion-request-reminder-scheduler.service';
import { SettingsModule } from '../settings/settings.module';
import { MailerModule } from '../mailer/mailer.module';
import { PrivacyModule } from '../privacy/privacy.module';

@Module({
  imports: [SettingsModule, MailerModule, PrivacyModule],
  controllers: [DeletionRequestsController],
  providers: [DeletionRequestsService, DeletionRequestReminderSchedulerService],
  exports: [DeletionRequestReminderSchedulerService],
})
export class DeletionRequestsModule {}
