import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { MediaFoldersService } from './media-folders.service';
import { CreateMediaFolderDto } from './dto/create-media-folder.dto';
import { UpdateMediaFolderDto } from './dto/update-media-folder.dto';
import { RequirePermission } from '../auth/decorators/permissions.decorator';

@ApiTags('media-folders')
@ApiBearerAuth()
@Controller('media-folders')
export class MediaFoldersController {
  constructor(private readonly mediaFoldersService: MediaFoldersService) {}

  @RequirePermission('media:read')
  @Get()
  findAll() {
    return this.mediaFoldersService.findAll();
  }

  @RequirePermission('media:create')
  @Post()
  create(@Body() dto: CreateMediaFolderDto) {
    return this.mediaFoldersService.create(dto);
  }

  @RequirePermission('media:update')
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateMediaFolderDto) {
    return this.mediaFoldersService.update(id, dto);
  }

  @RequirePermission('media:delete')
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.mediaFoldersService.remove(id);
  }
}
