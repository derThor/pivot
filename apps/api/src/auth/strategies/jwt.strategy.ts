import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';

export interface JwtPayload {
  sub: string;
  email: string;
  roleIds: string[];
  roleNames: string[];
  permissions: string[];
  canAccessDashboard: boolean;
  mustChangePassword: boolean;
  /** Siehe TwoFactorSetupGuard – true, wenn AppSettings.requireTwoFactorForAdmins
   *  aktiv ist, dieser Nutzer eine Administrator-Rolle hat und noch kein
   *  eigenes 2FA eingerichtet hat. */
  twoFactorSetupRequired: boolean;
  /** Nur bei Impersonation gesetzt: Nutzer-ID des Administrators, der
   *  gerade "als Nutzer ansehen" nutzt (siehe AuthService.impersonate()). */
  impersonatedBy?: string;
}

// Nur auf dem kurzlebigen 2FA-Challenge-Token gesetzt (siehe
// AuthService.login()), das denselben JWT_ACCESS_SECRET nutzt, aber vor
// bestandener 2FA-Prüfung ausgestellt wird. `validate()` unten weist jeden
// Token mit dieser Markierung hart ab, damit er nie als normaler
// Bearer-Token für irgendeine Route durchgeht – die einzige Stelle, die ihn
// versteht, ist AuthService.loginWithTwoFactor() (per jwt.verifyAsync()
// direkt entschlüsselt, nicht über diese Strategy).
export interface TwoFactorChallengePayload {
  sub: string;
  purpose: 'mfa-challenge';
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('JWT_ACCESS_SECRET'),
    });
  }

  validate(payload: JwtPayload | TwoFactorChallengePayload): JwtPayload {
    if ('purpose' in payload && payload.purpose === 'mfa-challenge') {
      throw new UnauthorizedException('Ungültiger Token-Typ.');
    }
    return payload as JwtPayload;
  }
}
