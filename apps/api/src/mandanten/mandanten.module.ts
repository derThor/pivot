import { Module } from '@nestjs/common';
import { MandantenService } from './mandanten.service';
import { MandantenController } from './mandanten.controller';
import { WebsitesModule } from '../websites/websites.module';

@Module({
  imports: [WebsitesModule],
  controllers: [MandantenController],
  providers: [MandantenService],
})
export class MandantenModule {}
