import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { TagsService } from './tags.service';
import { CreateTagDto } from './dto/create-tag.dto';
import { UpdateTagDto } from './dto/update-tag.dto';
import { QueryTagDto } from './dto/query-tag.dto';
import { RequirePermission } from '../auth/decorators/permissions.decorator';
import { FindPageDto } from '../common/dto/find-page.dto';

@ApiTags('tags')
@ApiBearerAuth()
@Controller('tags')
export class TagsController {
  constructor(private readonly tagsService: TagsService) {}

  @RequirePermission('tags:read')
  @Get()
  findAll(@Query() query: QueryTagDto) {
    return this.tagsService.findAll(query);
  }

  @RequirePermission('tags:read')
  @Get(':id/page')
  findPage(@Param('id') id: string, @Query() query: FindPageDto) {
    return this.tagsService.findPage(id, query.pageSize);
  }

  @RequirePermission('tags:create')
  @Post()
  create(@Body() dto: CreateTagDto) {
    return this.tagsService.create(dto);
  }

  @RequirePermission('tags:update')
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateTagDto) {
    return this.tagsService.update(id, dto);
  }

  @RequirePermission('tags:delete')
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.tagsService.remove(id);
  }
}
