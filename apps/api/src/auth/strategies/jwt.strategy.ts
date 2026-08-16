import { Injectable } from '@nestjs/common';
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
  /** Nur bei Impersonation gesetzt: Nutzer-ID des Administrators, der
   *  gerade "als Nutzer ansehen" nutzt (siehe AuthService.impersonate()). */
  impersonatedBy?: string;
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

  validate(payload: JwtPayload): JwtPayload {
    return payload;
  }
}
