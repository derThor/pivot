import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { LegalDocumentsService } from './legal-documents.service';
import { UpdateLegalDocumentDto } from './dto/update-legal-document.dto';
import { RequirePermission } from '../auth/decorators/permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/strategies/jwt.strategy';
import { RequireModule } from '../license-client/decorators/require-module.decorator';
import { RequireModuleFeature } from '../license-client/decorators/require-module-feature.decorator';
import { ModuleEntitlementGuard } from '../license-client/guards/module-entitlement.guard';
import { ModuleFeatureGuard } from '../license-client/guards/module-feature.guard';

// Datenschutz-als-Modul (Nutzervorgabe, 2026-08-28): Reiter "Rechtstexte" –
// 404, sofern das Datenschutz-Modul bzw. dieses Unter-Feature nicht aktiv
// ist (Master: `ModuleSettings`, Slave: signiert vom Master über
// `LicenseState`, siehe `LicenseClientService.getEffectiveStatus()`).
@ApiTags('legal-documents')
@ApiBearerAuth()
@UseGuards(ModuleEntitlementGuard, ModuleFeatureGuard)
@RequireModule('datenschutz')
@RequireModuleFeature('datenschutz', 'rechtstexte')
@Controller('legal-documents')
export class LegalDocumentsController {
  constructor(private readonly legalDocumentsService: LegalDocumentsService) {}

  @RequirePermission('privacy:read')
  @Get()
  findAll() {
    return this.legalDocumentsService.findAll();
  }

  @RequirePermission('privacy:update')
  @Post(':key/regenerate')
  regenerate(@Param('key') key: string, @CurrentUser() user: JwtPayload) {
    return this.legalDocumentsService.regenerate(key, user.sub);
  }

  @RequirePermission('privacy:update')
  @Patch(':key')
  updateAddendum(
    @Param('key') key: string,
    @Body() dto: UpdateLegalDocumentDto,
  ) {
    return this.legalDocumentsService.updateAddendum(key, dto);
  }
}
