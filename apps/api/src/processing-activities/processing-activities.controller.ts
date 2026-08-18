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
import { ProcessingActivitiesService } from './processing-activities.service';
import { CreateProcessingActivityDto } from './dto/create-processing-activity.dto';
import { UpdateProcessingActivityDto } from './dto/update-processing-activity.dto';
import { RequirePermission } from '../auth/decorators/permissions.decorator';

@ApiTags('processing-activities')
@ApiBearerAuth()
@Controller('processing-activities')
export class ProcessingActivitiesController {
  constructor(
    private readonly processingActivitiesService: ProcessingActivitiesService,
  ) {}

  @RequirePermission('privacy:read')
  @Get()
  findAll() {
    return this.processingActivitiesService.findAll();
  }

  @RequirePermission('privacy:create')
  @Post()
  create(@Body() dto: CreateProcessingActivityDto) {
    return this.processingActivitiesService.create(dto);
  }

  @RequirePermission('privacy:update')
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateProcessingActivityDto) {
    return this.processingActivitiesService.update(id, dto);
  }

  @RequirePermission('privacy:delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.processingActivitiesService.remove(id);
  }
}
