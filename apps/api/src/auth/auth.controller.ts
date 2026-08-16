import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { Public } from './decorators/public.decorator';
import { AllowPasswordChangeRequired } from './decorators/allow-password-change-required.decorator';
import { CurrentUser } from './decorators/current-user.decorator';
import type { JwtPayload } from './strategies/jwt.strategy';
import { UsersService } from '../users/users.service';
import { UpdateProfileDto } from '../users/dto/update-profile.dto';
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
  @Get('me')
  async me(@CurrentUser() user: JwtPayload) {
    const profile = await this.usersService.findOne(user.sub);
    return {
      ...profile,
      permissions: user.permissions,
      canAccessDashboard: user.canAccessDashboard,
      impersonatedBy: user.impersonatedBy,
    };
  }

  @ApiBearerAuth()
  @AllowPasswordChangeRequired()
  @Patch('me')
  updateMe(@CurrentUser() user: JwtPayload, @Body() dto: UpdateProfileDto) {
    return this.usersService.updateProfile(user.sub, dto);
  }

  @ApiBearerAuth()
  @AllowPasswordChangeRequired()
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
}
