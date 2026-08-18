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
import { DataProcessorsService } from './data-processors.service';
import { CreateDataProcessorDto } from './dto/create-data-processor.dto';
import { UpdateDataProcessorDto } from './dto/update-data-processor.dto';
import { RequirePermission } from '../auth/decorators/permissions.decorator';

@ApiTags('data-processors')
@ApiBearerAuth()
@Controller('data-processors')
export class DataProcessorsController {
  constructor(private readonly dataProcessorsService: DataProcessorsService) {}

  @RequirePermission('privacy:read')
  @Get()
  findAll() {
    return this.dataProcessorsService.findAll();
  }

  @RequirePermission('privacy:create')
  @Post()
  create(@Body() dto: CreateDataProcessorDto) {
    return this.dataProcessorsService.create(dto);
  }

  @RequirePermission('privacy:update')
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateDataProcessorDto) {
    return this.dataProcessorsService.update(id, dto);
  }

  @RequirePermission('privacy:delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.dataProcessorsService.remove(id);
  }
}
