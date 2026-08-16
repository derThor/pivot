import { Module, forwardRef } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { APP_GUARD } from '@nestjs/core';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './strategies/jwt.strategy';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { PermissionsGuard } from './guards/permissions.guard';
import { PasswordChangeGuard } from './guards/password-change.guard';
import { UsersModule } from '../users/users.module';
import { SettingsModule } from '../settings/settings.module';
import { MailerModule } from '../mailer/mailer.module';

@Module({
  imports: [
    PassportModule,
    JwtModule.register({}),
    forwardRef(() => UsersModule),
    SettingsModule,
    MailerModule,
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtStrategy,
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: PasswordChangeGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
  ],
  exports: [AuthService],
})
export class AuthModule {}
