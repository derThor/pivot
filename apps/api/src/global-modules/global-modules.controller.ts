import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { GlobalModulesService } from './global-modules.service';
import { CreateGlobalModuleDto } from './dto/create-global-module.dto';
import { UpdateGlobalModuleDto } from './dto/update-global-module.dto';
import { Public } from '../auth/decorators/public.decorator';
import { RequirePermission } from '../auth/decorators/permissions.decorator';

// Globale Module sind site-weite Struktur-Konfiguration (analog zu
// Navigationen/Webhooks), keine editorielle Content-Ressource – deshalb
// gegated über dieselbe `settings:manage`-Permission wie der Rest von
// /settings. Lesen ist dagegen `@Public()`: die anonyme Vorschau-Seite
// (`/preview/[token]`) muss die aktuellen Werte live auflösen können,
// exakt derselbe Grund wie bei `ModuleTypesController`.
@ApiTags('global-modules')
@ApiBearerAuth()
@Controller('global-modules')
export class GlobalModulesController {
  constructor(private readonly globalModulesService: GlobalModulesService) {}

  @Public()
  @Get()
  findAll() {
    return this.globalModulesService.findAll();
  }

  @Public()
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.globalModulesService.findOne(id);
  }

  @RequirePermission('settings:manage')
  @Post()
  create(@Body() dto: CreateGlobalModuleDto) {
    return this.globalModulesService.create(dto);
  }

  @RequirePermission('settings:manage')
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateGlobalModuleDto) {
    return this.globalModulesService.update(id, dto);
  }

  @RequirePermission('settings:manage')
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.globalModulesService.remove(id);
  }
}
