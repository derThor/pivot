import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { ALLOW_TWO_FACTOR_SETUP_REQUIRED_KEY } from '../decorators/allow-two-factor-setup-required.decorator';
import type { JwtPayload } from '../strategies/jwt.strategy';

// Erzwingt bei `twoFactorSetupRequired: true` (gesetzt in
// AuthService.issueTokens(), wenn eine der drei Pflicht-Stufen greift –
// AppSettings.requireTwoFactorForAll/-ForAdmins/-ForPublishers – und der
// Nutzer noch kein 2FA eingerichtet hat), dass nur mit
// `@AllowTwoFactorSetupRequired()` markierte Routen erreichbar bleiben –
// exakt dasselbe Muster wie PasswordChangeGuard für `mustChangePassword`.
@Injectable()
export class TwoFactorSetupGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const user = request.user as JwtPayload | undefined;
    if (!user || !user.twoFactorSetupRequired) {
      return true;
    }

    const allowed = this.reflector.getAllAndOverride<boolean>(
      ALLOW_TWO_FACTOR_SETUP_REQUIRED_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (allowed) {
      return true;
    }

    throw new ForbiddenException({
      message:
        'Einrichtung der Zwei-Faktor-Authentifizierung erforderlich, bevor fortgefahren werden kann.',
      code: 'TWO_FACTOR_SETUP_REQUIRED',
    });
  }
}
