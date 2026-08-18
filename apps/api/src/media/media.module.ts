import { forwardRef, Module } from '@nestjs/common';
import { MediaService } from './media.service';
import { MediaController } from './media.controller';
import { MediaImageProcessingService } from './media-image-processing.service';
import { SettingsModule } from '../settings/settings.module';

@Module({
  // forwardRef: SettingsModule -> AuthModule -> UsersModule -> MediaModule
  // ist bereits ein bestehender Zyklus (jeweils per forwardRef aufgelöst,
  // siehe settings.module.ts/auth.module.ts) – dieselbe Absicherung hier,
  // da MediaService jetzt AppSettings.maxUploadSizeMb liest.
  imports: [forwardRef(() => SettingsModule)],
  controllers: [MediaController],
  providers: [MediaService, MediaImageProcessingService],
  exports: [MediaService],
})
export class MediaModule {}
