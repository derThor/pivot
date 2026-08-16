import { Module, forwardRef } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { SettingsModule } from '../settings/settings.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  // `forwardRef`: AuthModule importiert seinerseits UsersModule (für
  // `AuthController.me()`/`updateMe()`) – UsersController braucht
  // umgekehrt `AuthService` für Sitzungen/Impersonation/Admin-Passwort-
  // Reset (siehe unten), daher zirkulärer Modul-Import.
  imports: [SettingsModule, forwardRef(() => AuthModule)],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
