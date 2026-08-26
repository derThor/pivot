import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { APP_GUARD } from '@nestjs/core';
import { LicenseClientService } from './license-client.service';
import { LicenseStateController } from './license-state.controller';
import { LicenseEnforcementGuard } from './license-enforcement.guard';
import { SettingsModule } from '../settings/settings.module';

@Module({
  imports: [JwtModule.register({}), SettingsModule],
  controllers: [LicenseStateController],
  providers: [
    LicenseClientService,
    { provide: APP_GUARD, useClass: LicenseEnforcementGuard },
  ],
  exports: [LicenseClientService],
})
export class LicenseClientModule {}
