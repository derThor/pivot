import { SetMetadata } from '@nestjs/common';

export const ALLOW_TWO_FACTOR_SETUP_REQUIRED_KEY =
  'allowTwoFactorSetupRequired';

// Markiert Routen, die trotz `twoFactorSetupRequired: true` erreichbar
// bleiben müssen (siehe TwoFactorSetupGuard) – die 2FA-Einrichtung selbst
// sowie Auslesen/Abmelden des eigenen Kontos.
export const AllowTwoFactorSetupRequired = () =>
  SetMetadata(ALLOW_TWO_FACTOR_SETUP_REQUIRED_KEY, true);
