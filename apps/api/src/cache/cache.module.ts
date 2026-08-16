import { Global, Module } from '@nestjs/common';
import { CacheService } from './cache.service';

// `@Global()`: jedes Modul kann `CacheService` injizieren, ohne
// `CacheModule` einzeln zu importieren – soll bewusst überall im Backend
// verwendbar sein, nicht nur an der einen Stelle, für die es zuerst gebaut
// wurde (siehe cache.service.ts).
@Global()
@Module({
  providers: [CacheService],
  exports: [CacheService],
})
export class CacheModule {}
