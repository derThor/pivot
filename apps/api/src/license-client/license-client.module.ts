import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { APP_GUARD } from '@nestjs/core';
import { LicenseClientService } from './license-client.service';
import { LicenseStateController } from './license-state.controller';
import { LicenseEnforcementGuard } from './license-enforcement.guard';
import { ModuleEntitlementGuard } from './guards/module-entitlement.guard';
import { ModuleFeatureGuard } from './guards/module-feature.guard';
import { SettingsModule } from '../settings/settings.module';

// Datenschutz-als-Modul (Nutzervorgabe, 2026-08-28): `@Global()`, damit
// `ModuleEntitlementGuard`/`ModuleFeatureGuard` app-weit ohne expliziten
// Modul-Import nutzbar sind – u.a. `SettingsModule` (Reiter "dsb") würde
// sonst einen echten Modul-Zirkelbezug erzeugen, da `LicenseClientModule`
// selbst bereits `SettingsModule` importiert.
@Global()
@Module({
  imports: [JwtModule.register({}), SettingsModule],
  controllers: [LicenseStateController],
  providers: [
    LicenseClientService,
    { provide: APP_GUARD, useClass: LicenseEnforcementGuard },
    ModuleEntitlementGuard,
    ModuleFeatureGuard,
  ],
  exports: [LicenseClientService, ModuleEntitlementGuard, ModuleFeatureGuard],
})
export class LicenseClientModule {}
