import { Module } from '@nestjs/common';
import { PublicContentService } from './public-content.service';
import { PublicContentController } from './public-content.controller';
import { GlobalModulesModule } from '../global-modules/global-modules.module';
import { CategoriesModule } from '../categories/categories.module';
import { TemplateRegionsModule } from '../template-regions/template-regions.module';

@Module({
  // `GlobalModulesModule` exportiert seinen Service – gebraucht für
  // `GET /public/global-modules` (siehe Controller-Kommentar).
  // CategoriesModule fuer den RSS-Feed nach Slug: der Feed wird dort
  // erzeugt, hier wird nur der Slug aufgeloest (siehe getCategoryFeed).
  imports: [GlobalModulesModule, CategoriesModule, TemplateRegionsModule],
  controllers: [PublicContentController],
  providers: [PublicContentService],
})
export class PublicContentModule {}
