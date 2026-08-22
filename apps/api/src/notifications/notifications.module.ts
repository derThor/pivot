import { Module } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { SettingsModule } from '../settings/settings.module';
import { MediaModule } from '../media/media.module';
import { TrashModule } from '../trash/trash.module';
import { UsersModule } from '../users/users.module';
import { LegalDocumentsModule } from '../legal-documents/legal-documents.module';
import { MailerModule } from '../mailer/mailer.module';

@Module({
  imports: [
    SettingsModule,
    MediaModule,
    TrashModule,
    UsersModule,
    LegalDocumentsModule,
    MailerModule,
  ],
  controllers: [NotificationsController],
  providers: [NotificationsService],
})
export class NotificationsModule {}
