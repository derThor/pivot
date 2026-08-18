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
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { FindPageDto } from '../common/dto/find-page.dto';
import type { JwtPayload } from '../auth/strategies/jwt.strategy';

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
  @Get('all')
  findAllUnpaginated() {
    return this.tagsService.findAllUnpaginated();
  }

  @RequirePermission('tags:delete')
  @Get('trash')
  findTrashed(@Query() query: QueryTagDto) {
    return this.tagsService.findTrashed(query);
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
  remove(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.tagsService.remove(id, user.sub);
  }

  @RequirePermission('tags:delete')
  @Post(':id/restore')
  restore(@Param('id') id: string) {
    return this.tagsService.restore(id);
  }

  @RequirePermission('tags:delete')
  @Delete(':id/permanent')
  permanentDelete(@Param('id') id: string) {
    return this.tagsService.permanentDelete(id);
  }
}
