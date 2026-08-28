import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { NotFoundException } from '@nestjs/common';
import { LicenseClientService } from '../license-client.service';
import {
  REQUIRE_MODULE_FEATURE_KEY,
  type RequireModuleFeatureMetadata,
} from '../decorators/require-module-feature.decorator';

/**
 * Datenschutz-als-Modul (Nutzervorgabe, 2026-08-28): feinere Ergänzung zu
 * `ModuleEntitlementGuard` – sperrt eine Route hart, sofern das per
 * `@RequireModuleFeature('datenschutz', 'vorfaelle')` geforderte
 * Unter-Feature eines Moduls nicht aktiv ist (404, gleiche Konvention).
 * Läuft über dieselbe, für Master/Slave einheitliche
 * `LicenseClientService.getEffectiveStatus()`-Quelle wie
 * `ModuleEntitlementGuard` – kein Sonderfall pro Installationsmodus.
 */
@Injectable()
export class ModuleFeatureGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly licenseClient: LicenseClientService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required =
      this.reflector.getAllAndOverride<RequireModuleFeatureMetadata>(
        REQUIRE_MODULE_FEATURE_KEY,
        [context.getHandler(), context.getClass()],
      );
    if (!required) {
      return true;
    }

    const effective = await this.licenseClient.getEffectiveStatus();
    const moduleFeatures =
      'moduleFeatures' in effective ? effective.moduleFeatures : {};
    const features = moduleFeatures[required.moduleKey] ?? [];
    if (!features.includes(required.featureKey)) {
      throw new NotFoundException();
    }
    return true;
  }
}
