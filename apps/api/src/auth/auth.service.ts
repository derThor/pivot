import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
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
import { summarizeUserAgent } from '../common/utils/user-agent';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

// Rohe Anfrage-Metadaten (User-Agent/IP), auf jedem ausgestellten
// RefreshToken gespeichert – Grundlage für "Aktive Sitzungen" (2b.14).
export interface RequestMeta {
  userAgent?: string;
  ipAddress?: string;
}

const VERIFICATION_TOKEN_TTL_MS = 24 * 60 * 60 * 1000; // 24h
const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1h
const IMPERSONATION_TTL_MS = 15 * 60 * 1000; // 15min, kein Refresh-Token

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
        userRoles: { create: { roleId: defaultRole.id } },
        isActive: !settings.requireAdminActivation,
        pendingActivation: settings.requireAdminActivation,
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

  async login(dto: LoginDto, meta: RequestMeta = {}) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (!user || !(await argon2.verify(user.passwordHash, dto.password))) {
      if (user) {
        await this.prisma.user.update({
          where: { id: user.id },
          data: { failedLoginAttempts: { increment: 1 } },
        });
      }
      throw new UnauthorizedException('Ungültige Zugangsdaten.');
    }
    if (!user.isActive) {
      throw new UnauthorizedException('Konto ist deaktiviert.');
    }

    if (user.failedLoginAttempts > 0) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { failedLoginAttempts: 0 },
      });
    }
    await this.touchLastLogin(user.id, user.lastLoginAt);

    return this.issueTokens(user.id, user.email, meta);
  }

  // Schreibt `lastLoginAt` nur, wenn der letzte Wert mind. 2 Minuten
  // zurückliegt – ohne Debounce würde jeder stille Token-Refresh (alle
  // ~15 Min., bei mehreren offenen Tabs auch öfter) einen eigenen Write
  // auslösen, obwohl sich der angezeigte "Zuletzt online"-Wert (Minuten-/
  // Stunden-Granularität) dadurch praktisch nie ändert.
  private static readonly LAST_LOGIN_DEBOUNCE_MS = 2 * 60 * 1000;

  private async touchLastLogin(userId: string, previous: Date | null) {
    if (
      previous &&
      Date.now() - previous.getTime() < AuthService.LAST_LOGIN_DEBOUNCE_MS
    ) {
      return;
    }
    await this.prisma.user.update({
      where: { id: userId },
      data: { lastLoginAt: new Date() },
    });
  }

  async refresh(refreshToken: string, meta: RequestMeta = {}) {
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
    // `lastLoginAt` hier zusätzlich zu `login()` aktualisieren, nicht nur
    // beim initialen Login: der stille Refresh läuft alle ~15 Min. im
    // Hintergrund, ohne das würde "Zuletzt online" bei langen Sessions
    // veraltet wirken, obwohl der Nutzer durchgehend aktiv ist.
    await this.touchLastLogin(stored.user.id, stored.user.lastLoginAt);

    return this.issueTokens(stored.user.id, stored.user.email, meta);
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
      data: { passwordHash, mustChangePassword: false },
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
        data: { passwordHash, mustChangePassword: false },
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

  // "Aktive Sitzungen" (2b.14): alle nicht widerrufenen, nicht abgelaufenen
  // RefreshTokens eines Nutzers, neueste zuerst. `currentRefreshToken` (roh,
  // aus dem Request der aufrufenden Person) markiert die eigene Sitzung als
  // "aktuelle Sitzung" – nur relevant, wenn ein Admin seine eigene
  // Nutzer-Seite betrachtet, sonst bleibt keine Zeile markiert.
  async listSessions(userId: string, currentRefreshToken?: string) {
    const currentHash = currentRefreshToken
      ? this.hashToken(currentRefreshToken)
      : undefined;
    const tokens = await this.prisma.refreshToken.findMany({
      where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
    });
    return tokens.map((token) => ({
      id: token.id,
      device: summarizeUserAgent(token.userAgent),
      ipAddress: token.ipAddress,
      createdAt: token.createdAt,
      isCurrent: !!currentHash && token.tokenHash === currentHash,
    }));
  }

  async revokeSession(userId: string, sessionId: string) {
    await this.prisma.refreshToken.updateMany({
      where: { id: sessionId, userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async revokeOtherSessions(userId: string, currentRefreshToken?: string) {
    const currentHash = currentRefreshToken
      ? this.hashToken(currentRefreshToken)
      : undefined;
    await this.prisma.refreshToken.updateMany({
      where: {
        userId,
        revokedAt: null,
        ...(currentHash && { tokenHash: { not: currentHash } }),
      },
      data: { revokedAt: new Date() },
    });
  }

  // Admin-ausgelöster Passwort-Reset (Button "Passwort zurücksetzen" auf der
  // Benutzer-Seite) – anders als `requestPasswordReset()` nicht an die
  // `allowPasswordReset`-Einstellung gebunden (die gilt fürs öffentliche
  // Self-Service-Formular) und ohne User-Enumeration-Schutz nötig, da der
  // Admin die Ziel-ID bereits kennt.
  async adminRequestPasswordReset(targetUserId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: targetUserId },
    });
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
      message: `Link zum Zurücksetzen wurde an ${user.email} gesendet.`,
      ...(!this.isProduction() && { resetLinkDevOnly: link }),
    };
  }

  // "Als Nutzer ansehen" (2b.14, Nutzervorgabe: Sicherheitsdesign in
  // eigenem Ermessen). Bewusste Entscheidungen:
  // - Kurzlebiger Access-Token (15min), KEIN Refresh-Token: die
  //   Impersonation-Sitzung läuft von selbst aus statt widerrufen werden
  //   zu müssen, und kann nicht durch stillen Refresh unbegrenzt verlängert
  //   werden.
  // - `impersonatedBy` im Payload macht die Impersonation im Access-Token
  //   selbst nachvollziehbar (nicht nur im Audit-Log).
  // - Administratoren dürfen weder sich selbst noch andere Administratoren
  //   impersonieren (keine Rechte-Ketten/Verschleierung unter Admins).
  // - Ziel-Konto muss aktiv und nicht anonymisiert sein.
  async impersonate(admin: { sub: string }, targetUserId: string) {
    if (admin.sub === targetUserId) {
      throw new BadRequestException(
        'Du kannst dich nicht selbst als Nutzer ansehen.',
      );
    }
    const target = await this.prisma.user.findUnique({
      where: { id: targetUserId },
      include: {
        userRoles: {
          include: {
            role: {
              include: { permissions: { include: { permission: true } } },
            },
          },
        },
      },
    });
    if (!target) {
      throw new BadRequestException('Nutzer nicht gefunden.');
    }
    if (!target.isActive || target.anonymizedAt) {
      throw new ForbiddenException(
        'Deaktivierte oder anonymisierte Nutzer können nicht angesehen werden.',
      );
    }
    const roles = target.userRoles.map((ur) => ur.role);
    if (roles.some((role) => role.name === 'Administrator')) {
      throw new ForbiddenException(
        'Administrator-Konten können nicht angesehen werden.',
      );
    }

    const permissions = [
      ...new Set(
        roles.flatMap((role) =>
          role.permissions.map(
            (rp) => `${rp.permission.resource}:${rp.permission.action}`,
          ),
        ),
      ),
    ];

    await this.prisma.auditLog.create({
      data: {
        action: 'user.impersonate',
        entityType: 'User',
        entityId: target.id,
        userId: admin.sub,
        metadata: { targetEmail: target.email },
      },
    });

    const accessToken = await this.jwt.signAsync(
      {
        sub: target.id,
        email: target.email,
        roleIds: roles.map((role) => role.id),
        roleNames: roles.map((role) => role.name),
        permissions,
        canAccessDashboard: roles.some((role) => role.canAccessDashboard),
        mustChangePassword: false,
        impersonatedBy: admin.sub,
      },
      {
        secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
        expiresIn: Math.floor(IMPERSONATION_TTL_MS / 1000),
      },
    );
    return { accessToken };
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

  private async issueTokens(
    userId: string,
    email: string,
    meta: RequestMeta = {},
  ): Promise<TokenPair> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      include: {
        userRoles: {
          include: {
            role: {
              include: { permissions: { include: { permission: true } } },
            },
          },
        },
      },
    });
    const roles = user.userRoles.map((ur) => ur.role);
    // Rechte-Vereinigung über alle Rollen des Nutzers (Nutzervorgabe
    // 2026-08-16: Mehrfach-Rollen) statt 1 Rolle → 1 Rechte-Set.
    const permissions = [
      ...new Set(
        roles.flatMap((role) =>
          role.permissions.map(
            (rp) => `${rp.permission.resource}:${rp.permission.action}`,
          ),
        ),
      ),
    ];
    // Dashboard-Zugriff, sobald mindestens eine zugewiesene Rolle ihn erlaubt.
    const canAccessDashboard = roles.some((role) => role.canAccessDashboard);

    const accessTtl = this.config.get<string>('JWT_ACCESS_TTL', '15m');
    const accessToken = await this.jwt.signAsync(
      {
        sub: userId,
        email,
        roleIds: roles.map((role) => role.id),
        roleNames: roles.map((role) => role.name),
        permissions,
        canAccessDashboard,
        mustChangePassword: user.mustChangePassword,
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
        userAgent: meta.userAgent,
        ipAddress: meta.ipAddress,
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
