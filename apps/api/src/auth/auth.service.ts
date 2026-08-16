import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { createHash, randomBytes } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';
import { MailerService } from '../mailer/mailer.service';
import { validatePasswordAgainstPolicy } from '../settings/password-policy';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import ms from '../common/utils/ms';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

const VERIFICATION_TOKEN_TTL_MS = 24 * 60 * 60 * 1000; // 24h
const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1h

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly settings: SettingsService,
    private readonly mailer: MailerService,
  ) {}

  async register(dto: RegisterDto) {
    const settings = await this.settings.get();
    if (!settings.allowRegistration) {
      throw new BadRequestException('Registrierung ist derzeit deaktiviert.');
    }

    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existing) {
      throw new ConflictException('E-Mail-Adresse wird bereits verwendet.');
    }

    const violations = validatePasswordAgainstPolicy(dto.password, settings);
    if (violations.length > 0) {
      throw new BadRequestException(violations.join(' '));
    }

    const defaultRole = await this.prisma.role.findFirstOrThrow({
      where: { isDefault: true },
    });
    const passwordHash = await argon2.hash(dto.password);
    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        firstName: dto.firstName,
        lastName: dto.lastName,
        passwordHash,
        roleId: defaultRole.id,
        isActive: !settings.requireAdminActivation,
      },
    });

    const verificationLinkDevOnly = await this.issueEmailVerification(
      user.id,
      user.email,
    );

    if (!user.isActive) {
      return {
        pendingActivation: true,
        message:
          'Konto wurde angelegt und wartet auf Freischaltung durch einen Administrator.',
        ...(verificationLinkDevOnly && { verificationLinkDevOnly }),
      };
    }

    const tokens = await this.issueTokens(user.id, user.email);
    return {
      ...tokens,
      ...(verificationLinkDevOnly && { verificationLinkDevOnly }),
    };
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (!user || !(await argon2.verify(user.passwordHash, dto.password))) {
      throw new UnauthorizedException('Ungültige Zugangsdaten.');
    }
    if (!user.isActive) {
      throw new UnauthorizedException('Konto ist deaktiviert.');
    }

    return this.issueTokens(user.id, user.email);
  }

  async refresh(refreshToken: string) {
    const tokenHash = this.hashToken(refreshToken);
    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (
      !stored ||
      stored.revokedAt ||
      stored.expiresAt.getTime() < Date.now()
    ) {
      throw new UnauthorizedException(
        'Refresh-Token ungültig oder abgelaufen.',
      );
    }
    // Ohne diesen Check könnte ein deaktivierter Nutzer mit einem noch
    // gültigen Refresh-Token beliebig lange neue Access-Tokens holen –
    // `UsersService.remove()` widerruft zwar alle Refresh-Tokens beim
    // Deaktivieren, aber ein Request, der genau in diesem Moment "in
    // Flight" war, würde diesen Check sonst umgehen.
    if (!stored.user.isActive) {
      throw new UnauthorizedException('Konto ist deaktiviert.');
    }

    // Rotation: altes Token widerrufen, neues Paar ausstellen
    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });

    return this.issueTokens(stored.user.id, stored.user.email);
  }

  async logout(refreshToken: string) {
    const tokenHash = this.hashToken(refreshToken);
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });
    if (!(await argon2.verify(user.passwordHash, dto.currentPassword))) {
      throw new UnauthorizedException('Aktuelles Passwort ist falsch.');
    }

    const settings = await this.settings.get();
    const violations = validatePasswordAgainstPolicy(dto.newPassword, settings);
    if (violations.length > 0) {
      throw new BadRequestException(violations.join(' '));
    }

    const passwordHash = await argon2.hash(dto.newPassword);
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });
    await this.revokeAllRefreshTokens(userId);
  }

  async requestPasswordReset(dto: ForgotPasswordDto) {
    const settings = await this.settings.get();
    if (!settings.allowPasswordReset) {
      throw new BadRequestException('Passwort-Reset ist derzeit deaktiviert.');
    }

    const genericMessage =
      'Falls die E-Mail-Adresse existiert, wurde eine Nachricht mit weiteren Schritten versendet.';

    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (!user) {
      // Bewusst keine Auskunft, ob die E-Mail existiert (User-Enumeration vermeiden).
      return { message: genericMessage };
    }

    const token = randomBytes(32).toString('hex');
    await this.prisma.passwordResetToken.create({
      data: {
        tokenHash: this.hashToken(token),
        userId: user.id,
        expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS),
      },
    });
    const link = `${this.frontendOrigin()}/reset-password?token=${token}`;
    await this.mailer.sendPasswordResetEmail(user.email, link);

    return {
      message: genericMessage,
      ...(!this.isProduction() && { resetLinkDevOnly: link }),
    };
  }

  async resetPassword(dto: ResetPasswordDto) {
    const tokenHash = this.hashToken(dto.token);
    const stored = await this.prisma.passwordResetToken.findUnique({
      where: { tokenHash },
    });
    if (!stored || stored.usedAt || stored.expiresAt.getTime() < Date.now()) {
      throw new BadRequestException(
        'Der Link ist ungültig oder abgelaufen. Bitte fordere einen neuen an.',
      );
    }

    const settings = await this.settings.get();
    const violations = validatePasswordAgainstPolicy(dto.newPassword, settings);
    if (violations.length > 0) {
      throw new BadRequestException(violations.join(' '));
    }

    const passwordHash = await argon2.hash(dto.newPassword);
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: stored.userId },
        data: { passwordHash },
      }),
      this.prisma.passwordResetToken.update({
        where: { id: stored.id },
        data: { usedAt: new Date() },
      }),
    ]);
    await this.revokeAllRefreshTokens(stored.userId);
  }

  async verifyEmail(token: string) {
    const tokenHash = this.hashToken(token);
    const stored = await this.prisma.emailVerificationToken.findUnique({
      where: { tokenHash },
    });
    if (!stored || stored.usedAt || stored.expiresAt.getTime() < Date.now()) {
      throw new BadRequestException(
        'Der Verifikations-Link ist ungültig oder abgelaufen.',
      );
    }

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: stored.userId },
        data: { emailVerifiedAt: new Date() },
      }),
      this.prisma.emailVerificationToken.update({
        where: { id: stored.id },
        data: { usedAt: new Date() },
      }),
    ]);

    return { message: 'E-Mail-Adresse erfolgreich verifiziert.' };
  }

  async resendVerification(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });
    if (user.emailVerifiedAt) {
      return { message: 'E-Mail-Adresse ist bereits verifiziert.' };
    }

    const verificationLinkDevOnly = await this.issueEmailVerification(
      user.id,
      user.email,
    );
    return {
      message: 'Verifikations-Mail wurde erneut gesendet.',
      ...(verificationLinkDevOnly && { verificationLinkDevOnly }),
    };
  }

  private async issueEmailVerification(
    userId: string,
    email: string,
  ): Promise<string | undefined> {
    const token = randomBytes(32).toString('hex');
    await this.prisma.emailVerificationToken.create({
      data: {
        tokenHash: this.hashToken(token),
        userId,
        expiresAt: new Date(Date.now() + VERIFICATION_TOKEN_TTL_MS),
      },
    });
    const link = `${this.frontendOrigin()}/verify-email?token=${token}`;
    await this.mailer.sendVerificationEmail(email, link);
    return this.isProduction() ? undefined : link;
  }

  private async revokeAllRefreshTokens(userId: string) {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  private async issueTokens(userId: string, email: string): Promise<TokenPair> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      include: {
        role: { include: { permissions: { include: { permission: true } } } },
      },
    });
    const permissions = user.role.permissions.map(
      (rp) => `${rp.permission.resource}:${rp.permission.action}`,
    );

    const accessTtl = this.config.get<string>('JWT_ACCESS_TTL', '15m');
    const accessToken = await this.jwt.signAsync(
      {
        sub: userId,
        email,
        roleId: user.roleId,
        roleName: user.role.name,
        permissions,
        canAccessDashboard: user.role.canAccessDashboard,
      },
      {
        secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
        expiresIn: Math.floor(ms(accessTtl) / 1000),
      },
    );

    const refreshToken = randomBytes(48).toString('hex');
    const refreshTtl = this.config.get<string>('JWT_REFRESH_TTL', '30d');

    await this.prisma.refreshToken.create({
      data: {
        tokenHash: this.hashToken(refreshToken),
        userId,
        expiresAt: new Date(Date.now() + ms(refreshTtl)),
      },
    });

    return { accessToken, refreshToken };
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private frontendOrigin(): string {
    return this.config.get<string>('CORS_ORIGIN', 'http://localhost:3000');
  }

  private isProduction(): boolean {
    return this.config.get<string>('NODE_ENV') === 'production';
  }
}
