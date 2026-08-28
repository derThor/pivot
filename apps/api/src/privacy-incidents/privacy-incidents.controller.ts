import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PrivacyIncidentsService } from './privacy-incidents.service';
import { CreatePrivacyIncidentDto } from './dto/create-privacy-incident.dto';
import { UpdatePrivacyIncidentDto } from './dto/update-privacy-incident.dto';
import { RequirePermission } from '../auth/decorators/permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/strategies/jwt.strategy';
import { RequireModule } from '../license-client/decorators/require-module.decorator';
import { RequireModuleFeature } from '../license-client/decorators/require-module-feature.decorator';
import { ModuleEntitlementGuard } from '../license-client/guards/module-entitlement.guard';
import { ModuleFeatureGuard } from '../license-client/guards/module-feature.guard';

// Datenschutz-als-Modul (Nutzervorgabe, 2026-08-28): Reiter "Vorfälle".
@ApiTags('privacy-incidents')
@ApiBearerAuth()
@UseGuards(ModuleEntitlementGuard, ModuleFeatureGuard)
@RequireModule('datenschutz')
@RequireModuleFeature('datenschutz', 'vorfaelle')
@Controller('privacy-incidents')
export class PrivacyIncidentsController {
  constructor(
    private readonly privacyIncidentsService: PrivacyIncidentsService,
  ) {}

  @RequirePermission('privacy:read')
  @Get()
  findAll() {
    return this.privacyIncidentsService.findAll();
  }

  @RequirePermission('privacy:create')
  @Post()
  create(@Body() dto: CreatePrivacyIncidentDto) {
    return this.privacyIncidentsService.create(dto);
  }

  @RequirePermission('privacy:update')
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdatePrivacyIncidentDto) {
    return this.privacyIncidentsService.update(id, dto);
  }

  @RequirePermission('privacy:delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.privacyIncidentsService.remove(id);
  }

  @RequirePermission('privacy:update')
  @Post(':id/report')
  reportToAuthority(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.privacyIncidentsService.reportToAuthority(id, user.sub);
  }

  @RequirePermission('privacy:read')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="meldung.csv"')
  @Get(':id/report')
  generateReport(@Param('id') id: string) {
    return this.privacyIncidentsService.generateReportCsv(id);
  }

  @RequirePermission('privacy:update')
  @Post(':id/notify-subjects')
  notifySubjects(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.privacyIncidentsService.notifySubjects(id, user.sub);
  }
}
