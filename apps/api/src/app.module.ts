import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { CacheModule } from './cache/cache.module';
import { AuditLogModule } from './audit-log/audit-log.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { ContentModule } from './content/content.module';
import { ContentTypesModule } from './content-types/content-types.module';
import { ModuleTypesModule } from './module-types/module-types.module';
import { MediaModule } from './media/media.module';
import { MediaFoldersModule } from './media-folders/media-folders.module';
import { CategoriesModule } from './categories/categories.module';
import { TagsModule } from './tags/tags.module';
import { SettingsModule } from './settings/settings.module';
import { RolesModule } from './roles/roles.module';
import { MailerModule } from './mailer/mailer.module';
import { SearchModule } from './search/search.module';
import { WebhooksModule } from './webhooks/webhooks.module';
import { NavigationModule } from './navigation/navigation.module';
import { GlobalModulesModule } from './global-modules/global-modules.module';
import { CompanyLocationsModule } from './company-locations/company-locations.module';
import { LegalDocumentsModule } from './legal-documents/legal-documents.module';
import { DeletionRequestsModule } from './deletion-requests/deletion-requests.module';
import { ProcessingActivitiesModule } from './processing-activities/processing-activities.module';
import { DataProcessorsModule } from './data-processors/data-processors.module';
import { PrivacyIncidentsModule } from './privacy-incidents/privacy-incidents.module';
import { PrivacyModule } from './privacy/privacy.module';
import { TrashModule } from './trash/trash.module';
import { NotificationsModule } from './notifications/notifications.module';
import { JobsModule } from './jobs/jobs.module';
import { validateEnv } from './common/config/env.validation';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
      envFilePath: process.env.NODE_ENV === 'test' ? '.env.test' : '.env',
    }),
    ThrottlerModule.forRoot({
      throttlers: [{ ttl: 60_000, limit: 100 }],
    }),
    ScheduleModule.forRoot(),
    PrismaModule,
    CacheModule,
    AuditLogModule,
    AuthModule,
    UsersModule,
    ContentModule,
    ContentTypesModule,
    ModuleTypesModule,
    MediaModule,
    MediaFoldersModule,
    CategoriesModule,
    TagsModule,
    SettingsModule,
    RolesModule,
    MailerModule,
    SearchModule,
    WebhooksModule,
    NavigationModule,
    GlobalModulesModule,
    CompanyLocationsModule,
    LegalDocumentsModule,
    DeletionRequestsModule,
    ProcessingActivitiesModule,
    DataProcessorsModule,
    PrivacyIncidentsModule,
    PrivacyModule,
    TrashModule,
    NotificationsModule,
    JobsModule,
  ],
  controllers: [AppController],
  providers: [AppService, { provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
