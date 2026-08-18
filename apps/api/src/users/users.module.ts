import { Module, forwardRef } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { SettingsModule } from '../settings/settings.module';
import { AuthModule } from '../auth/auth.module';
import { MediaModule } from '../media/media.module';

@Module({
  // `forwardRef`: AuthModule importiert seinerseits UsersModule (für
  // `AuthController.me()`/`updateMe()`) – UsersController braucht
  // umgekehrt `AuthService` für Sitzungen/Impersonation/Admin-Passwort-
  // Reset (siehe unten), daher zirkulärer Modul-Import. MediaModule für
  // den eigenen Avatar-Upload (`updateAvatar()`, wiederverwendet
  // `MediaService.create()` statt eines zweiten Upload-Mechanismus).
  imports: [SettingsModule, forwardRef(() => AuthModule), MediaModule],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
