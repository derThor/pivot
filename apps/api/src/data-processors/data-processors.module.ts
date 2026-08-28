import { Module } from '@nestjs/common';
import { DataProcessorsService } from './data-processors.service';
import { DataProcessorsController } from './data-processors.controller';
import { MailerModule } from '../mailer/mailer.module';
import { MediaModule } from '../media/media.module';
import { LicenseClientModule } from '../license-client/license-client.module';

@Module({
  imports: [MailerModule, MediaModule, LicenseClientModule],
  controllers: [DataProcessorsController],
  providers: [DataProcessorsService],
})
export class DataProcessorsModule {}
