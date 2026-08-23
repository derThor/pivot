import { Module } from '@nestjs/common';
import { TrashService } from './trash.service';
import { TrashController } from './trash.controller';
import { SettingsModule } from '../settings/settings.module';
import { ContentModule } from '../content/content.module';
import { MediaModule } from '../media/media.module';
import { CategoriesModule } from '../categories/categories.module';
import { TagsModule } from '../tags/tags.module';
import { GlobalModulesModule } from '../global-modules/global-modules.module';
import { FormsModule } from '../forms/forms.module';

@Module({
  imports: [
    SettingsModule,
    ContentModule,
    MediaModule,
    CategoriesModule,
    TagsModule,
    GlobalModulesModule,
    FormsModule,
  ],
  controllers: [TrashController],
  providers: [TrashService],
  exports: [TrashService],
})
export class TrashModule {}
