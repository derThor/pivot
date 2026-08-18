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
// Berechtigung wie die übrigen Firmenangaben (bisher unter Einstellungen),
// kein eigenes Recht nötig.
@ApiTags('company-locations')
@ApiBearerAuth()
@Controller('company-locations')
export class CompanyLocationsController {
  constructor(
    private readonly companyLocationsService: CompanyLocationsService,
  ) {}

  @RequirePermission('settings:read')
  @Get()
  findAll() {
    return this.companyLocationsService.findAll();
  }

  @RequirePermission('settings:update')
  @Post()
  create(@Body() dto: CreateCompanyLocationDto) {
    return this.companyLocationsService.create(dto);
  }

  @RequirePermission('settings:update')
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateCompanyLocationDto) {
    return this.companyLocationsService.update(id, dto);
  }

  @RequirePermission('settings:update')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.companyLocationsService.remove(id);
  }
}
