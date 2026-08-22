import { Module } from '@nestjs/common';
import { PrivacyService } from './privacy.service';
import { PrivacyController } from './privacy.controller';
import { PrivacyReportSchedulerService } from './privacy-report-scheduler.service';
import { SettingsModule } from '../settings/settings.module';
import { UsersModule } from '../users/users.module';
import { ContentModule } from '../content/content.module';
import { MediaModule } from '../media/media.module';
import { CategoriesModule } from '../categories/categories.module';
import { TagsModule } from '../tags/tags.module';
import { LegalDocumentsModule } from '../legal-documents/legal-documents.module';
import { MailerModule } from '../mailer/mailer.module';

@Module({
  imports: [
    SettingsModule,
    UsersModule,
    ContentModule,
    MediaModule,
    CategoriesModule,
    TagsModule,
    LegalDocumentsModule,
    MailerModule,
  ],
  controllers: [PrivacyController],
  providers: [PrivacyService, PrivacyReportSchedulerService],
  // Von DeletionRequestsModule genutzt: "Datenauszug erstellen" generiert
  // bei einem verknüpften Konto den echten Art.-15-Bericht statt eine
  // zweite CSV-Erzeugung zu pflegen.
  exports: [PrivacyService],
})
export class PrivacyModule {}
