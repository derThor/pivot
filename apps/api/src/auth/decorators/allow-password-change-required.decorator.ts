import { SetMetadata } from '@nestjs/common';

export const ALLOW_PASSWORD_CHANGE_REQUIRED_KEY = 'allowPasswordChangeRequired';

// Markiert Routen, die trotz `mustChangePassword: true` erreichbar bleiben
// müssen (siehe PasswordChangeGuard) – v.a. das Ändern des Passworts selbst
// und das Auslesen/Abmelden des eigenen Kontos.
export const AllowPasswordChangeRequired = () =>
  SetMetadata(ALLOW_PASSWORD_CHANGE_REQUIRED_KEY, true);
