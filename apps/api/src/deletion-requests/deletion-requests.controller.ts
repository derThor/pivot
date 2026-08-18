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
import { DeletionRequestsService } from './deletion-requests.service';
import { CreateDeletionRequestDto } from './dto/create-deletion-request.dto';
import { UpdateDeletionRequestDto } from './dto/update-deletion-request.dto';
import { RequirePermission } from '../auth/decorators/permissions.decorator';

@ApiTags('deletion-requests')
@ApiBearerAuth()
@Controller('deletion-requests')
export class DeletionRequestsController {
  constructor(
    private readonly deletionRequestsService: DeletionRequestsService,
  ) {}

  @RequirePermission('privacy:read')
  @Get()
  findAll() {
    return this.deletionRequestsService.findAll();
  }

  @RequirePermission('privacy:create')
  @Post()
  create(@Body() dto: CreateDeletionRequestDto) {
    return this.deletionRequestsService.create(dto);
  }

  @RequirePermission('privacy:update')
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateDeletionRequestDto) {
    return this.deletionRequestsService.update(id, dto);
  }

  @RequirePermission('privacy:delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.deletionRequestsService.remove(id);
  }
}
