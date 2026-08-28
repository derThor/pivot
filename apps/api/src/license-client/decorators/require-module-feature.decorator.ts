import { SetMetadata } from '@nestjs/common';

// Datenschutz-als-Modul (Nutzervorgabe, 2026-08-28) – siehe ModuleFeatureGuard.
export const REQUIRE_MODULE_FEATURE_KEY = 'requireModuleFeature';

export interface RequireModuleFeatureMetadata {
  moduleKey: string;
  featureKey: string;
}

export const RequireModuleFeature = (moduleKey: string, featureKey: string) =>
  SetMetadata(REQUIRE_MODULE_FEATURE_KEY, { moduleKey, featureKey });
