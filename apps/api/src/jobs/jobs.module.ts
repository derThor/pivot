import { Module } from '@nestjs/common';
import { JobsService } from './jobs.service';
import { JobsController } from './jobs.controller';
import { SettingsModule } from '../settings/settings.module';
import { MailerModule } from '../mailer/mailer.module';
import { ContentModule } from '../content/content.module';
import { DeletionRequestsModule } from '../deletion-requests/deletion-requests.module';
import { PrivacyModule } from '../privacy/privacy.module';

@Module({
  imports: [
    SettingsModule,
    MailerModule,
    ContentModule,
    DeletionRequestsModule,
    PrivacyModule,
  ],
  controllers: [JobsController],
  providers: [JobsService],
})
export class JobsModule {}
