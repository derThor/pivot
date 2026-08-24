import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { LicenseClientService } from './license-client.service';
import { LicenseStateController } from './license-state.controller';
import { LicenseEnforcementGuard } from './license-enforcement.guard';

@Module({
  controllers: [LicenseStateController],
  providers: [
    LicenseClientService,
    { provide: APP_GUARD, useClass: LicenseEnforcementGuard },
  ],
  exports: [LicenseClientService],
})
export class LicenseClientModule {}
