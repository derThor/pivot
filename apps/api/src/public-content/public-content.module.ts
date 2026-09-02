import { Module } from '@nestjs/common';
import { PublicContentService } from './public-content.service';
import { PublicContentController } from './public-content.controller';
import { GlobalModulesModule } from '../global-modules/global-modules.module';

@Module({
  // `GlobalModulesModule` exportiert seinen Service – gebraucht für
  // `GET /public/global-modules` (siehe Controller-Kommentar).
  imports: [GlobalModulesModule],
  controllers: [PublicContentController],
  providers: [PublicContentService],
})
export class PublicContentModule {}
