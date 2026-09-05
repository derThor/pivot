import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';

import { FrontendTemplatesService } from './frontend-templates.service';
import { UpdateFrontendTemplateDto } from './dto/update-frontend-template.dto';
import { RequirePermission } from '../auth/decorators/permissions.decorator';

/** Obergrenze fürs Paket. Ein Template ist CSS, etwas JSON und ein
 * Handvoll Bilder/Schriften – wer 20 MB hochlädt, hat etwas anderes
 * eingepackt. */
const MAX_PACKAGE_BYTES = 20 * 1024 * 1024;

/**
 * Hochgeladene Frontend-Templates.
 *
 * **Rechte:** `settings:update` – ein Template zu wechseln verändert das
 * Aussehen der gesamten öffentlichen Webseite und ist damit eine
 * Einstellung dieser Installation, keine redaktionelle Arbeit. Bewusst
 * kein eigenes Recht: der Bereich lebt unter Einstellungen → Frontend,
 * und wer dort etwas darf, darf es hier auch.
 */
@ApiTags('frontend-templates')
@ApiBearerAuth()
@Controller('frontend-templates')
export class FrontendTemplatesController {
  constructor(private readonly templates: FrontendTemplatesService) {}

  @RequirePermission('settings:read')
  @Get()
  findAll() {
    return this.templates.findAll();
  }

  @RequirePermission('settings:update')
  @ApiConsumes('multipart/form-data')
  @Post()
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: MAX_PACKAGE_BYTES } }),
  )
  upload(@UploadedFile() file?: Express.Multer.File) {
    if (!file) throw new BadRequestException('Es wurde keine Datei gesendet.');
    return this.templates.importPackage(file.buffer);
  }

  @RequirePermission('settings:update')
  @Post(':id/activate')
  activate(@Param('id') id: string) {
    return this.templates.activate(id);
  }

  /** Zurück auf das eingebaute Template des Frontend-Projekts. */
  @RequirePermission('settings:update')
  @Post('deactivate')
  deactivate() {
    return this.templates.deactivateAll();
  }

  @RequirePermission('settings:update')
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateFrontendTemplateDto) {
    return this.templates.update(id, dto);
  }

  @RequirePermission('settings:update')
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.templates.remove(id);
  }
}
