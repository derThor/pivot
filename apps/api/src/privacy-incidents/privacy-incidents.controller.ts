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
import { PrivacyIncidentsService } from './privacy-incidents.service';
import { CreatePrivacyIncidentDto } from './dto/create-privacy-incident.dto';
import { UpdatePrivacyIncidentDto } from './dto/update-privacy-incident.dto';
import { RequirePermission } from '../auth/decorators/permissions.decorator';

@ApiTags('privacy-incidents')
@ApiBearerAuth()
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
}
