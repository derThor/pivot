import { SetMetadata } from '@nestjs/common';

// Mandantenfähigkeit (Nutzervorgabe, 2026-08-27) – siehe ModuleEntitlementGuard.
export const REQUIRE_MODULE_KEY = 'requireModule';
export const RequireModule = (moduleKey: string) =>
  SetMetadata(REQUIRE_MODULE_KEY, moduleKey);
