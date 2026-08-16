import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { CacheModule } from './cache/cache.module';
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
  ],
  controllers: [AppController],
  providers: [AppService, { provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
