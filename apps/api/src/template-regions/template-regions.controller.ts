import { Body, Controller, Get, Param, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { TemplateRegionsService } from './template-regions.service';
import { SaveTemplateRegionDto } from './dto/save-template-region.dto';
import { Prisma } from '@pivot/database';
import { RequirePermission } from '../auth/decorators/permissions.decorator';

/**
 * Bereiche des Frontend-Templates (Kopfbereich, Fußbereich, …) – ihr
 * Inhalt sind Bausteine wie bei einer Seite.
 *
 * **Rechte:** bewusst die vorhandenen Inhalts-Rechte statt neuer eigener.
 * Wer Seiten baut, gestaltet auch Kopf und Fuß – dieselbe Überlegung wie
 * bei der Reihenfolge der Baustein-Palette (`content:update` an
 * `ModuleTypesController.reorder`). Ein eigenes Recht ließe sich später
 * ergänzen, ohne dass sich hier etwas ändert.
 */
@ApiTags('template-regions')
@ApiBearerAuth()
@Controller('template-regions')
export class TemplateRegionsController {
  constructor(private readonly regions: TemplateRegionsService) {}

  @RequirePermission('content:read')
  @Get()
  findAll() {
    return this.regions.findAll();
  }

  @RequirePermission('content:read')
  @Get(':key')
  findOne(@Param('key') key: string) {
    return this.regions.findOne(key);
  }

  @RequirePermission('content:update')
  @Put(':key')
  save(@Param('key') key: string, @Body() dto: SaveTemplateRegionDto) {
    // Die Form der Bausteine bestimmt der Modul-Typ, nicht dieses DTO –
    // für Prisma ist das ein Json-Wert (gleiche Behandlung wie
    // `Content.data`).
    return this.regions.save(key, dto.data as Prisma.InputJsonValue);
  }
}
