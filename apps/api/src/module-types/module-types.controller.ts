import { Body, Controller, Get, Param, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ModuleTypesService } from './module-types.service';
import { Public } from '../auth/decorators/public.decorator';
import { ReorderModuleTypesDto } from './dto/reorder-module-types.dto';
import { RequirePermission } from '../auth/decorators/permissions.decorator';

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
// `@Public()` steht seit 2026-09-03 an den einzelnen LESE-Routen statt
// an der Klasse: seit es hier auch eine schreibende Route gibt (Reihenfolge
// der Palette), wäre ein klassenweites `@Public()` ein offenes Scheunentor
// – die Berechtigungsprüfung an der Methode liefe gar nicht erst an.
@ApiTags('module-types')
@Controller('module-types')
export class ModuleTypesController {
  constructor(private readonly moduleTypesService: ModuleTypesService) {}

  @Public()
  @Get()
  findAll() {
    return this.moduleTypesService.findAll();
  }

  @Public()
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.moduleTypesService.findOne(id);
  }

  /** Reihenfolge der Baustein-Palette (Nutzervorgabe, 2026-09-03).
   *
   * Anders als das Lesen NICHT öffentlich: das Ordnen ist eine
   * redaktionelle Einstellung, die für alle gilt. `content:update` statt
   * eines eigenen Rechts – wer Seiten baut, ordnet auch seine Palette. */
  @ApiBearerAuth()
  @RequirePermission('content:update')
  @Patch('reorder')
  reorder(@Body() dto: ReorderModuleTypesDto) {
    return this.moduleTypesService.reorder(dto.ids);
  }
}
