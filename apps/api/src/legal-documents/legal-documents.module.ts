import { Module } from '@nestjs/common';
import { LegalDocumentsService } from './legal-documents.service';
import { LegalDocumentsController } from './legal-documents.controller';
import { SettingsModule } from '../settings/settings.module';
import { LicenseClientModule } from '../license-client/license-client.module';

@Module({
  imports: [SettingsModule, LicenseClientModule],
  controllers: [LegalDocumentsController],
  providers: [LegalDocumentsService],
  exports: [LegalDocumentsService],
})
export class LegalDocumentsModule {}
