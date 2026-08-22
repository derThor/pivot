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
import { TwoFactorVerifyDto } from './dto/two-factor-verify.dto';
import { TwoFactorDisableDto } from './dto/two-factor-disable.dto';
import { TwoFactorLoginVerifyDto } from './dto/two-factor-login-verify.dto';
import { TwoFactorService } from './two-factor/two-factor.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import type { TwoFactorChallengePayload } from './strategies/jwt.strategy';
import ms from '../common/utils/ms';
import { summarizeUserAgent } from '../common/utils/user-agent';
import { isPasswordLeaked } from '../common/utils/pwned-password';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

// Login-Antwort, wenn der Nutzer 2FA aktiviert hat: statt echter Tokens nur
// ein kurzlebiges, eng zweckgebundenes Challenge-Token (siehe
// issueTwoFactorChallengeToken()) – erst nach POST /auth/2fa/login-verify
// mit gültigem Code gibt es ein echtes TokenPair.
export interface MfaChallengeResponse {
  mfaRequired: true;
  challengeToken: string;
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
const MFA_CHALLENGE_TTL_MS = 5 * 60 * 1000; // 5min – knapp bemessen, der Nutzer hat das Handy bereits in der Hand

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly settings: SettingsService,
    private readonly mailer: MailerService,
    private readonly twoFactor: TwoFactorService,
    private readonly auditLog: AuditLogService,
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
    await this.assertPasswordNotLeaked(settings, dto.password);

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
        passwordChangedAt: new Date(),
        userRoles: { create: { roleId: defaultRole.id } },
        isActive: !settings.requireAdminActivation,
        pendingActivation: settings.requireAdminActivation,
      },
    });
    await this.recordPasswordHistory(user.id, passwordHash);

    await this.auditLog.record({
      action: 'user.created',
      entityType: 'User',
      entityId: user.id,
      userId: user.id,
      metadata: { method: 'self_registered' },
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

  async login(
    dto: LoginDto,
    meta: RequestMeta = {},
  ): Promise<TokenPair | MfaChallengeResponse> {
    const settings = await this.settings.get();
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (!user || !(await argon2.verify(user.passwordHash, dto.password))) {
      if (user) {
        const failedLoginAttempts = user.failedLoginAttempts + 1;
        // Automatische Sperre nach N Fehlversuchen (Nutzervorgabe,
        // 2026-08-17) – setzt denselben `isActive: false`-Zustand wie die
        // manuelle "Sperren"-Aktion (siehe UsersService.remove()), damit
        // "Gesperrt"-Badge und "Entsperren"-Button im Bearbeiten-Dialog
        // ohne Sonderfall funktionieren.
        const shouldLock =
          settings.failedLoginLockoutThreshold != null &&
          failedLoginAttempts >= settings.failedLoginLockoutThreshold;
        await this.prisma.user.update({
          where: { id: user.id },
          data: {
            failedLoginAttempts,
            ...(shouldLock && { isActive: false }),
          },
        });
      }
      throw new UnauthorizedException('Ungültige Zugangsdaten.');
    }
    if (!user.isActive) {
      throw new UnauthorizedException('Konto ist deaktiviert.');
    }

    // Passwort-Ablauf (Nutzervorgabe, 2026-08-17): erzwingt einen
    // Passwortwechsel über denselben `mustChangePassword`-Mechanismus wie
    // "Passwortwechsel bei nächster Anmeldung erzwingen" – Konten ohne
    // `passwordChangedAt` (vor Einführung dieses Felds) laufen bewusst nie
    // ab, statt einen erfundenen Startzeitpunkt anzunehmen.
    const passwordExpired =
      settings.passwordExpiryDays != null &&
      user.passwordChangedAt != null &&
      Date.now() - user.passwordChangedAt.getTime() >
        settings.passwordExpiryDays * 24 * 60 * 60 * 1000;

    if (user.failedLoginAttempts > 0 || passwordExpired) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          ...(user.failedLoginAttempts > 0 && { failedLoginAttempts: 0 }),
          ...(passwordExpired && { mustChangePassword: true }),
        },
      });
    }

    // Passwort ist korrekt, aber noch kein vollständiger Login: solange der
    // zweite Faktor nicht bestätigt ist, gibt es weder echte Tokens noch ein
    // aktualisiertes `lastLoginAt` (siehe loginWithTwoFactor() unten).
    if (settings.allowTwoFactor && user.twoFactorEnabled) {
      const challengeToken = await this.issueTwoFactorChallengeToken(user.id);
      return { mfaRequired: true, challengeToken };
    }

    await this.touchLastLogin(user.id, user.lastLoginAt);
    return this.issueTokens(user.id, user.email, meta);
  }

  private async issueTwoFactorChallengeToken(userId: string): Promise<string> {
    const payload: TwoFactorChallengePayload = {
      sub: userId,
      purpose: 'mfa-challenge',
    };
    return this.jwt.signAsync(payload, {
      secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
      expiresIn: Math.floor(MFA_CHALLENGE_TTL_MS / 1000),
    });
  }

  // Zweiter Schritt des Logins bei aktivierter 2FA: nimmt das Challenge-Token
  // aus login() plus TOTP- oder Recovery-Code entgegen und stellt bei Erfolg
  // echte Tokens aus – exakt dieselbe issueTokens()-Instanz wie ein
  // normaler Login, damit sich beide Wege in nichts unterscheiden.
  async loginWithTwoFactor(
    dto: TwoFactorLoginVerifyDto,
    meta: RequestMeta = {},
  ): Promise<TokenPair> {
    let payload: TwoFactorChallengePayload;
    try {
      payload = await this.jwt.verifyAsync<TwoFactorChallengePayload>(
        dto.challengeToken,
        { secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET') },
      );
    } catch {
      throw new UnauthorizedException(
        'Challenge-Token ungültig oder abgelaufen.',
      );
    }
    if (payload.purpose !== 'mfa-challenge') {
      throw new UnauthorizedException('Challenge-Token ungültig.');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });
    if (!user || !user.isActive || !user.twoFactorEnabled) {
      throw new UnauthorizedException(
        'Zwei-Faktor-Authentifizierung nicht verfügbar.',
      );
    }

    const isValidTotpCode =
      !!user.twoFactorSecret &&
      (await this.twoFactor.verifyCode(
        this.twoFactor.decryptSecret(user.twoFactorSecret),
        dto.code,
      ));

    if (isValidTotpCode) {
      await this.touchLastLogin(user.id, user.lastLoginAt);
      return this.issueTokens(user.id, user.email, meta);
    }

    // Fallback: einer der einmalig einlösbaren Recovery-Codes.
    const matchIndex = await this.twoFactor.matchRecoveryCode(
      user.twoFactorRecoveryCodes,
      dto.code,
    );
    if (matchIndex === -1) {
      throw new UnauthorizedException('Ungültiger Code.');
    }
    const remainingRecoveryCodes = [...user.twoFactorRecoveryCodes];
    remainingRecoveryCodes.splice(matchIndex, 1);
    await this.prisma.user.update({
      where: { id: user.id },
      data: { twoFactorRecoveryCodes: remainingRecoveryCodes },
    });
    await this.touchLastLogin(user.id, user.lastLoginAt);
    return this.issueTokens(user.id, user.email, meta);
  }

  // Self-Service-Einrichtung (Konto-Seite "Sicherheit"-Tab): erzeugt ein
  // neues Secret und überschreibt ein evtl. vorheriges, nie bestätigtes
  // (twoFactorEnabled bleibt bis verifyTwoFactorSetup() auf false – ein
  // generiertes, aber nicht bestätigtes Secret aktiviert nichts).
  async setupTwoFactor(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });
    const settings = await this.settings.get();
    if (!settings.allowTwoFactor) {
      throw new BadRequestException(
        'Zwei-Faktor-Authentifizierung ist derzeit deaktiviert.',
      );
    }

    const secret = this.twoFactor.generateSecret();
    await this.prisma.user.update({
      where: { id: userId },
      data: { twoFactorSecret: this.twoFactor.encryptSecret(secret) },
    });
    const qrCodeDataUrl = await this.twoFactor.buildQrCodeDataUrl(
      secret,
      user.email,
    );
    return { secret, qrCodeDataUrl };
  }

  // Bestätigt die Einrichtung mit dem ersten gescannten Code und schaltet
  // 2FA scharf. Recovery-Codes werden nur hier (und nicht schon bei
  // setupTwoFactor()) erzeugt, damit ein abgebrochener Setup-Versuch keine
  // toten Codes hinterlässt.
  async verifyTwoFactorSetup(userId: string, dto: TwoFactorVerifyDto) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });
    if (!user.twoFactorSecret) {
      throw new BadRequestException(
        'Es läuft keine 2FA-Einrichtung. Bitte zuerst einen QR-Code anfordern.',
      );
    }
    const secret = this.twoFactor.decryptSecret(user.twoFactorSecret);
    if (!(await this.twoFactor.verifyCode(secret, dto.code))) {
      throw new BadRequestException('Code ist ungültig oder abgelaufen.');
    }

    const recoveryCodes = this.twoFactor.generateRecoveryCodes();
    const hashedRecoveryCodes =
      await this.twoFactor.hashRecoveryCodes(recoveryCodes);
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        twoFactorEnabled: true,
        twoFactorEnabledAt: new Date(),
        twoFactorRecoveryCodes: hashedRecoveryCodes,
      },
    });
    await this.auditLog.record({
      action: 'user.2fa_enabled',
      entityType: 'User',
      entityId: userId,
      userId,
    });
    // Codes verlassen den Server nur dieses eine Mal im Klartext.
    return { recoveryCodes };
  }

  // Self-Service-Deaktivierung – Passwort-Bestätigung statt eines weiteren
  // TOTP-Codes, da der Nutzer hier gerade den zweiten Faktor loswerden will
  // (könnte z.B. genau deshalb keinen gültigen Code mehr haben).
  async disableTwoFactor(userId: string, dto: TwoFactorDisableDto) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });
    if (!(await argon2.verify(user.passwordHash, dto.password))) {
      throw new UnauthorizedException('Passwort ist falsch.');
    }
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        twoFactorEnabled: false,
        twoFactorEnabledAt: null,
        twoFactorSecret: null,
        twoFactorRecoveryCodes: [],
      },
    });
    await this.auditLog.record({
      action: 'user.2fa_disabled',
      entityType: 'User',
      entityId: userId,
      userId,
    });
  }

  // "Neue Codes generieren" (Mein Konto → Sicherheit): die alten Codes sind
  // gehasht und lassen sich nicht erneut anzeigen (siehe Offener Punkt in
  // knowledge-base/auth/two-factor-authentication.md) – dies ersetzt sie
  // komplett durch einen frischen Satz, alte werden dadurch ungültig.
  async regenerateRecoveryCodes(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });
    if (!user.twoFactorEnabled) {
      throw new BadRequestException(
        'Zwei-Faktor-Authentifizierung ist nicht aktiviert.',
      );
    }
    const recoveryCodes = this.twoFactor.generateRecoveryCodes();
    const hashedRecoveryCodes =
      await this.twoFactor.hashRecoveryCodes(recoveryCodes);
    await this.prisma.user.update({
      where: { id: userId },
      data: { twoFactorRecoveryCodes: hashedRecoveryCodes },
    });
    return { recoveryCodes };
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

    // Inaktivitäts-Timeout (Nutzervorgabe, 2026-08-17): `lastUsedAt` steht
    // faktisch für "Zeitpunkt der letzten Aktivität dieser Sitzung", da
    // jede Anfrage über die Middleware bei abgelaufenem Access-Token genau
    // hier rotiert – ein wirklich untätiger Tab löst keine neuen Requests
    // aus. Prüfung vor der Rotation, nicht danach, sonst würde ein
    // längst überzogenes Token sich durch den bloßen Aufruf selbst
    // verlängern.
    const settings = await this.settings.get();
    if (
      settings.sessionIdleTimeoutMinutes != null &&
      Date.now() - stored.lastUsedAt.getTime() >
        settings.sessionIdleTimeoutMinutes * 60 * 1000
    ) {
      await this.prisma.refreshToken.update({
        where: { id: stored.id },
        data: { revokedAt: new Date() },
      });
      throw new UnauthorizedException(
        'Sitzung wegen Inaktivität beendet. Bitte erneut anmelden.',
      );
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
    await this.assertPasswordNotLeaked(settings, dto.newPassword);
    if (settings.passwordPreventReuseEnabled) {
      await this.assertPasswordNotReused(
        userId,
        user.passwordHash,
        dto.newPassword,
      );
    }

    const passwordHash = await argon2.hash(dto.newPassword);
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        passwordHash,
        mustChangePassword: false,
        passwordChangedAt: new Date(),
      },
    });
    await this.recordPasswordHistory(userId, passwordHash);
    await this.auditLog.record({
      action: 'user.password_changed',
      entityType: 'User',
      entityId: userId,
      userId,
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
    await this.assertPasswordNotLeaked(settings, dto.newPassword);
    if (settings.passwordPreventReuseEnabled) {
      const currentUser = await this.prisma.user.findUniqueOrThrow({
        where: { id: stored.userId },
      });
      await this.assertPasswordNotReused(
        stored.userId,
        currentUser.passwordHash,
        dto.newPassword,
      );
    }

    const passwordHash = await argon2.hash(dto.newPassword);
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: stored.userId },
        data: {
          passwordHash,
          mustChangePassword: false,
          passwordChangedAt: new Date(),
        },
      }),
      this.prisma.passwordResetToken.update({
        where: { id: stored.id },
        data: { usedAt: new Date() },
      }),
    ]);
    await this.recordPasswordHistory(stored.userId, passwordHash);
    await this.auditLog.record({
      action: 'user.password_changed',
      entityType: 'User',
      entityId: stored.userId,
      userId: stored.userId,
    });
    await this.revokeAllRefreshTokens(stored.userId);
  }

  private async assertPasswordNotLeaked(
    settings: { passwordBlockLeaked: boolean },
    password: string,
  ) {
    if (settings.passwordBlockLeaked && (await isPasswordLeaked(password))) {
      throw new BadRequestException(
        'Dieses Passwort wurde in bekannten Datenlecks gefunden. Bitte ein anderes wählen.',
      );
    }
  }

  // Prüft gegen den aktuellen Hash + die letzten 4 PasswordHistory-Einträge
  // (zusammen 5, siehe AppSettings.passwordPreventReuseEnabled).
  private async assertPasswordNotReused(
    userId: string,
    currentPasswordHash: string,
    newPassword: string,
  ) {
    const recent = await this.prisma.passwordHistory.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 4,
    });
    const hashesToCheck = [
      currentPasswordHash,
      ...recent.map((entry) => entry.passwordHash),
    ];
    for (const hash of hashesToCheck) {
      if (await argon2.verify(hash, newPassword)) {
        throw new BadRequestException(
          'Dieses Passwort wurde kürzlich bereits verwendet. Bitte ein anderes wählen.',
        );
      }
    }
  }

  // Merkt sich den neuen Hash und entfernt Einträge jenseits der letzten 5
  // (siehe assertPasswordNotReused()).
  private async recordPasswordHistory(userId: string, passwordHash: string) {
    await this.prisma.passwordHistory.create({
      data: { userId, passwordHash },
    });
    const excess = await this.prisma.passwordHistory.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      skip: 5,
      select: { id: true },
    });
    if (excess.length > 0) {
      await this.prisma.passwordHistory.deleteMany({
        where: { id: { in: excess.map((entry) => entry.id) } },
      });
    }
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
    // Pivot ebenfalls gesperrt (Nutzervorgabe, 2026-08-21): sonst könnte
    // ein Administrator per Impersonation doch an Pivot-exklusive
    // Einstellungen kommen, obwohl "keine admins" für Einstellungen gilt.
    if (roles.some((role) => ['Administrator', 'Pivot'].includes(role.name))) {
      throw new ForbiddenException(
        'Administrator- und Pivot-Konten können nicht angesehen werden.',
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
        // Ziel-Konto kann nie Administrator sein (siehe Check oben) – die
        // Erzwingung greift nur für Admins, hier also immer false.
        twoFactorSetupRequired: false,
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

  // Globale Admin-Aktion auf der Einstellungsseite ("Alle Sitzungen
  // beenden", Nutzervorgabe 2026-08-17) – widerruft jedes noch gültige
  // Refresh-Token systemweit, nicht nur eines einzelnen Kontos (anders als
  // revokeAllRefreshTokens() oben). Meldet jeden betroffenen Nutzer selbst
  // als Akteur an, nicht den auslösenden Admin – die Sitzung *dieses*
  // Nutzers wurde beendet, unabhängig davon, wer die Aktion ausgelöst hat.
  async revokeAllSessionsGlobally(actingUserId: string) {
    const { count } = await this.prisma.refreshToken.updateMany({
      where: { revokedAt: null },
      data: { revokedAt: new Date() },
    });
    await this.auditLog.record({
      action: 'auth.all_sessions_revoked',
      entityType: 'System',
      entityId: 'global',
      userId: actingUserId,
      metadata: { count },
    });
    return { count };
  }

  // Globale Admin-Aktion ("Passwort-Reset für alle erzwingen") – setzt
  // `mustChangePassword` für jedes aktive, nicht anonymisierte Konto.
  // Gleicher Mechanismus wie die bestehende Einzel-Nutzer-Aktion in
  // UpdateUserDto, greift wie dort erst beim nächsten Token (Login/
  // Refresh), kein sofortiger Zwangs-Logout.
  async forcePasswordResetForAllUsers(actingUserId: string) {
    const { count } = await this.prisma.user.updateMany({
      where: { isActive: true, anonymizedAt: null, mustChangePassword: false },
      data: { mustChangePassword: true },
    });
    await this.auditLog.record({
      action: 'auth.password_reset_forced_all',
      entityType: 'System',
      entityId: 'global',
      userId: actingUserId,
      metadata: { count },
    });
    return { count };
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

    // Siehe TwoFactorSetupGuard: erzwingt 2FA-Einrichtung, wenn eine der
    // drei unabhängigen Pflicht-Stufen greift (Nutzervorgabe, 2026-08-17:
    // "für alle Konten" / "für Rollen mit Veröffentlichungsrecht" / die
    // bestehende "für Administratoren") – jede für sich ODER-verknüpft,
    // nur solange das Feature global überhaupt erlaubt ist (allowTwoFactor).
    const settings = await this.settings.get();
    const twoFactorSetupRequired =
      settings.allowTwoFactor &&
      !user.twoFactorEnabled &&
      (settings.requireTwoFactorForAll ||
        (settings.requireTwoFactorForAdmins &&
          roles.some((role) =>
            ['Administrator', 'Pivot'].includes(role.name),
          )) ||
        (settings.requireTwoFactorForPublishers &&
          permissions.includes('content:publish')));

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
        twoFactorSetupRequired,
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
