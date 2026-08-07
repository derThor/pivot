import { Controller, Get, Param } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ModuleTypesService } from './module-types.service';
import { Public } from '../auth/decorators/public.decorator';

// Modul-Typen sind (wie Content-Typen) aktuell nur lesbar – Anlegen/
// Bearbeiten läuft über den Seed, keine eigene Verwaltungs-UI. Gleiche
// bewusste Design-Entscheidung wie bei ContentTypesController.
//
// Öffentlich (kein JWT nötig): die anonyme Vorschau-Seite
// (`/preview/[token]`) muss Modul-Typ-Schemas auflösen können, um
// `Content.data.blocks` korrekt zu rendern – exakt derselbe Grund, aus
// dem `GET /content/preview/:token` bereits `@Public()` ist. Modul-Typen
// enthalten keine sensiblen Daten (nur Name/Icon/Feldschema, vergleichbar
// mit einer öffentlichen Komponenten-Bibliothek).
@ApiTags('module-types')
@Public()
@Controller('module-types')
export class ModuleTypesController {
  constructor(private readonly moduleTypesService: ModuleTypesService) {}

  @Get()
  findAll() {
    return this.moduleTypesService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.moduleTypesService.findOne(id);
  }
}
