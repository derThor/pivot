import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Request } from 'express';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { TwoFactorVerifyDto } from './dto/two-factor-verify.dto';
import { TwoFactorDisableDto } from './dto/two-factor-disable.dto';
import { TwoFactorLoginVerifyDto } from './dto/two-factor-login-verify.dto';
import { Public } from './decorators/public.decorator';
import { AllowPasswordChangeRequired } from './decorators/allow-password-change-required.decorator';
import { AllowTwoFactorSetupRequired } from './decorators/allow-two-factor-setup-required.decorator';
import { CurrentUser } from './decorators/current-user.decorator';
import type { JwtPayload } from './strategies/jwt.strategy';
import { UsersService } from '../users/users.service';
import { UpdateProfileDto } from '../users/dto/update-profile.dto';
import { multerOptions } from '../media/media.config';
import type { RequestMeta } from './auth.service';

// Für "Aktive Sitzungen" (2b.14): Roh-User-Agent + Client-IP aus der
// Anfrage, wird auf dem jeweils ausgestellten `RefreshToken` gespeichert.
// `x-forwarded-for` hat Vorrang vor `req.ip`: Login/Refresh laufen über die
// Next.js-Middleware/API-Routen (server-seitiger `fetch()`), `req.ip` wäre
// sonst die interne Adresse des Next.js-Servers statt die des echten
// Browsers – die Proxy-Routen reichen den Header deshalb explizit durch.
function requestMeta(req: Request): RequestMeta {
  const forwardedFor = req.headers['x-forwarded-for'];
  const forwardedIp = Array.isArray(forwardedFor)
    ? forwardedFor[0]
    : forwardedFor?.split(',')[0]?.trim();
  return {
    userAgent: req.headers['user-agent'],
    ipAddress: forwardedIp || req.ip,
  };
}

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly usersService: UsersService,
  ) {}

  @Public()
  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('login')
  login(@Body() dto: LoginDto, @Req() req: Request) {
    return this.authService.login(dto, requestMeta(req));
  }

  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('refresh')
  refresh(@Body() dto: RefreshTokenDto, @Req() req: Request) {
    return this.authService.refresh(dto.refreshToken, requestMeta(req));
  }

  @Public()
  @HttpCode(HttpStatus.NO_CONTENT)
  @Post('logout')
  logout(@Body() dto: RefreshTokenDto) {
    return this.authService.logout(dto.refreshToken);
  }

  @ApiBearerAuth()
  @AllowPasswordChangeRequired()
  @AllowTwoFactorSetupRequired()
  @Get('me')
  async me(@CurrentUser() user: JwtPayload) {
    const profile = await this.usersService.findOne(user.sub);
    return {
      ...profile,
      permissions: user.permissions,
      canAccessDashboard: user.canAccessDashboard,
      impersonatedBy: user.impersonatedBy,
      // Fürs Redirect-/Banner-Verhalten im Dashboard (siehe middleware.ts
      // und AccountLockBanner) – ohne dieses Feld hätte das Frontend keine
      // Möglichkeit zu erkennen, dass der TwoFactorSetupGuard gerade fast
      // alle Routen sperrt, und Seiten blieben kommentarlos leer.
      twoFactorSetupRequired: user.twoFactorSetupRequired,
    };
  }

  @ApiBearerAuth()
  @AllowPasswordChangeRequired()
  @AllowTwoFactorSetupRequired()
  @Patch('me')
  updateMe(@CurrentUser() user: JwtPayload, @Body() dto: UpdateProfileDto) {
    return this.usersService.updateProfile(user.sub, dto);
  }

  @ApiBearerAuth()
  @AllowPasswordChangeRequired()
  @AllowTwoFactorSetupRequired()
  @Patch('password')
  changePassword(
    @CurrentUser() user: JwtPayload,
    @Body() dto: ChangePasswordDto,
  ) {
    return this.authService.changePassword(user.sub, dto);
  }

  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('forgot-password')
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.requestPasswordReset(dto);
  }

  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('reset-password')
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }

  @Public()
  @Get('verify-email')
  verifyEmail(@Query('token') token: string) {
    return this.authService.verifyEmail(token);
  }

  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @Post('resend-verification')
  resendVerification(@CurrentUser() user: JwtPayload) {
    return this.authService.resendVerification(user.sub);
  }

  // Self-Service 2FA (Konto-Seite "Sicherheit"-Tab) – braucht beide
  // @Allow*Required()-Decorator, damit ein Administrator, dessen Konto
  // gerade wegen requireTwoFactorForAdmins gesperrt ist, die Einrichtung
  // überhaupt erreichen kann.
  @ApiBearerAuth()
  @AllowTwoFactorSetupRequired()
  @HttpCode(HttpStatus.OK)
  @Post('2fa/setup')
  setupTwoFactor(@CurrentUser() user: JwtPayload) {
    return this.authService.setupTwoFactor(user.sub);
  }

  @ApiBearerAuth()
  @AllowTwoFactorSetupRequired()
  @HttpCode(HttpStatus.OK)
  @Post('2fa/verify-setup')
  verifyTwoFactorSetup(
    @CurrentUser() user: JwtPayload,
    @Body() dto: TwoFactorVerifyDto,
  ) {
    return this.authService.verifyTwoFactorSetup(user.sub, dto);
  }

  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @Post('2fa/disable')
  disableTwoFactor(
    @CurrentUser() user: JwtPayload,
    @Body() dto: TwoFactorDisableDto,
  ) {
    return this.authService.disableTwoFactor(user.sub, dto);
  }

  // Public: der Client hat an dieser Stelle noch keinen Bearer-Token, nur
  // das Challenge-Token aus der mfaRequired-Antwort von /auth/login.
  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('2fa/login-verify')
  loginVerify(@Body() dto: TwoFactorLoginVerifyDto, @Req() req: Request) {
    return this.authService.loginWithTwoFactor(dto, requestMeta(req));
  }

  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @Post('2fa/regenerate-recovery-codes')
  regenerateRecoveryCodes(@CurrentUser() user: JwtPayload) {
    return this.authService.regenerateRecoveryCodes(user.sub);
  }

  // "Mein Konto"-Seiten (Profil/Sicherheit): eigene `/auth/me/*`-Routen
  // statt der bestehenden `/users/:id/*`-Pendants, weil letztere
  // `users:read`/`users:update` verlangen – ein Nutzer ohne dieses Recht
  // (z.B. Rolle "Gast") muss trotzdem seine eigene Statistik/Sitzungen
  // sehen können, ohne administrative Rechte zu brauchen. Gleiches Muster
  // wie /auth/me selbst.
  @ApiBearerAuth()
  @AllowPasswordChangeRequired()
  @AllowTwoFactorSetupRequired()
  @Get('me/stats')
  getMyStats(@CurrentUser() user: JwtPayload) {
    return this.usersService.getWeeklyStats(user.sub);
  }

  @ApiBearerAuth()
  @AllowPasswordChangeRequired()
  @AllowTwoFactorSetupRequired()
  @Get('me/sessions')
  listMySessions(
    @CurrentUser() user: JwtPayload,
    @Headers('x-current-refresh-token') currentRefreshToken?: string,
  ) {
    return this.authService.listSessions(user.sub, currentRefreshToken);
  }

  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete('me/sessions/:sessionId')
  revokeMySession(
    @CurrentUser() user: JwtPayload,
    @Param('sessionId') sessionId: string,
  ) {
    return this.authService.revokeSession(user.sub, sessionId);
  }

  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @Post('me/sessions/revoke-others')
  revokeMyOtherSessions(
    @CurrentUser() user: JwtPayload,
    @Headers('x-current-refresh-token') currentRefreshToken?: string,
  ) {
    return this.authService.revokeOtherSessions(user.sub, currentRefreshToken);
  }

  // Eigenes Profilfoto – nutzt denselben Upload-Mechanismus wie das
  // Firmenlogo (POST /media), aber als eigener Endpunkt statt direkt
  // gegen /media: jeder Nutzer darf sein eigenes Foto ändern, unabhängig
  // vom media:create-Recht (siehe UsersService.updateAvatar()).
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @Post('me/avatar')
  @UseInterceptors(FileInterceptor('file', multerOptions))
  updateMyAvatar(
    @CurrentUser() user: JwtPayload,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.usersService.updateAvatar(user.sub, file);
  }
}
