import { Global, Module } from '@nestjs/common';
import { AuditLogService } from './audit-log.service';

// `@Global()`: Users-, Auth-, Media- und Content-Modul brauchen alle
// dieselbe `.record()`-Methode, ohne dieses Modul jeweils einzeln zu
// importieren – gleiches Muster wie `CacheModule`.
@Global()
@Module({
  providers: [AuditLogService],
  exports: [AuditLogService],
})
export class AuditLogModule {}
