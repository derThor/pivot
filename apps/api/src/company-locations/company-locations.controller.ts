import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CompanyLocationsService } from './company-locations.service';
import { CreateCompanyLocationDto } from './dto/create-company-location.dto';
import { UpdateCompanyLocationDto } from './dto/update-company-location.dto';
import { RequirePermission } from '../auth/decorators/permissions.decorator';

// Teil der Firma-Seite unter Verwaltung (2026-08-17) – nutzt dieselbe
// Berechtigung wie die übrigen Firmenangaben. Seit 2026-08-21 `company:*`
// statt `settings:*` (Nutzervorgabe: "admin soll aber firma sehen können"
// – Administrator hat kein `settings:*` mehr, `company:*` bleibt ihm
// aber erhalten, siehe permissions.catalog.ts).
@ApiTags('company-locations')
@ApiBearerAuth()
@Controller('company-locations')
export class CompanyLocationsController {
  constructor(
    private readonly companyLocationsService: CompanyLocationsService,
  ) {}

  @RequirePermission('company:read')
  @Get()
  findAll() {
    return this.companyLocationsService.findAll();
  }

  @RequirePermission('company:update')
  @Post()
  create(@Body() dto: CreateCompanyLocationDto) {
    return this.companyLocationsService.create(dto);
  }

  @RequirePermission('company:update')
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateCompanyLocationDto) {
    return this.companyLocationsService.update(id, dto);
  }

  @RequirePermission('company:update')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.companyLocationsService.remove(id);
  }
}
