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
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { DataProcessorsService } from './data-processors.service';
import { CreateDataProcessorDto } from './dto/create-data-processor.dto';
import { UpdateDataProcessorDto } from './dto/update-data-processor.dto';
import { RequirePermission } from '../auth/decorators/permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/strategies/jwt.strategy';
import { RequireModule } from '../license-client/decorators/require-module.decorator';
import { RequireModuleFeature } from '../license-client/decorators/require-module-feature.decorator';
import { ModuleEntitlementGuard } from '../license-client/guards/module-entitlement.guard';
import { ModuleFeatureGuard } from '../license-client/guards/module-feature.guard';

// Datenschutz-als-Modul (Nutzervorgabe, 2026-08-28): Reiter "Auftragsverarbeiter".
@ApiTags('data-processors')
@ApiBearerAuth()
@UseGuards(ModuleEntitlementGuard, ModuleFeatureGuard)
@RequireModule('datenschutz')
@RequireModuleFeature('datenschutz', 'auftragsverarbeiter')
@Controller('data-processors')
export class DataProcessorsController {
  constructor(private readonly dataProcessorsService: DataProcessorsService) {}

  @RequirePermission('privacy:read')
  @Get()
  findAll() {
    return this.dataProcessorsService.findAll();
  }

  // Muss vor `:id`-Routen stehen, sonst würde Nest "contracts.zip" als
  // `:id` interpretieren.
  @RequirePermission('privacy:read')
  @Get('contracts.zip')
  async downloadContracts(@Res() res: Response) {
    await this.dataProcessorsService.streamContractsZip(res);
  }

  @RequirePermission('privacy:create')
  @Post()
  create(@Body() dto: CreateDataProcessorDto) {
    return this.dataProcessorsService.create(dto);
  }

  @RequirePermission('privacy:update')
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateDataProcessorDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.dataProcessorsService.update(id, dto, user.sub);
  }

  @RequirePermission('privacy:delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.dataProcessorsService.remove(id, user.sub);
  }

  @RequirePermission('privacy:update')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Post(':id/request-contract')
  requestContract(@Param('id') id: string) {
    return this.dataProcessorsService.requestContract(id);
  }
}
