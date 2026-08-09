import { Module } from '@nestjs/common';
import { GlobalModulesService } from './global-modules.service';
import { GlobalModulesController } from './global-modules.controller';

@Module({
  controllers: [GlobalModulesController],
  providers: [GlobalModulesService],
})
export class GlobalModulesModule {}
