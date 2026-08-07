import { Module } from '@nestjs/common';
import { ModuleTypesService } from './module-types.service';
import { ModuleTypesController } from './module-types.controller';

@Module({
  controllers: [ModuleTypesController],
  providers: [ModuleTypesService],
  exports: [ModuleTypesService],
})
export class ModuleTypesModule {}
