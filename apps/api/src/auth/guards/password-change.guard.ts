import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { ALLOW_PASSWORD_CHANGE_REQUIRED_KEY } from '../decorators/allow-password-change-required.decorator';
import type { JwtPayload } from '../strategies/jwt.strategy';

// Sperrt bei `mustChangePassword: true` alle Routen außer den mit
// `@AllowPasswordChangeRequired()` markierten (Passwort ändern, eigenes
// Konto lesen/abmelden) – erzwingt so den Passwortwechsel, bevor der Rest
// des Dashboards nutzbar ist. Reine `@Public()`-Routen (kein `request.user`)
// sind davon unberührt.
@Injectable()
export class PasswordChangeGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const user = request.user as JwtPayload | undefined;
    if (!user || !user.mustChangePassword) {
      return true;
    }

    const allowed = this.reflector.getAllAndOverride<boolean>(
      ALLOW_PASSWORD_CHANGE_REQUIRED_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (allowed) {
      return true;
    }

    throw new ForbiddenException({
      message: 'Passwortwechsel erforderlich, bevor fortgefahren werden kann.',
      code: 'PASSWORD_CHANGE_REQUIRED',
    });
  }
}
