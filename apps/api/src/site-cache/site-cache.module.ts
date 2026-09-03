import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { SiteCacheService } from './site-cache.service';

/** Global wie `CacheModule`: die Auslöser sitzen über die ganze App
 * verteilt (Inhalte, Kategorien, Menüs, Rechtstexte, Einstellungen), und
 * jeder dieser Bereiche müsste das Modul sonst einzeln importieren. */
@Global()
@Module({
  imports: [JwtModule.register({})],
  providers: [SiteCacheService],
  exports: [SiteCacheService],
})
export class SiteCacheModule {}
