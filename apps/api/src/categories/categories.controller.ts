import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CategoriesService } from './categories.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { QueryCategoryDto } from './dto/query-category.dto';
import { RequirePermission } from '../auth/decorators/permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { FindPageDto } from '../common/dto/find-page.dto';
import type { JwtPayload } from '../auth/strategies/jwt.strategy';

@ApiTags('categories')
@ApiBearerAuth()
@Controller('categories')
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @RequirePermission('categories:read')
  @Get()
  findAll(@Query() query: QueryCategoryDto) {
    return this.categoriesService.findAll(query);
  }

  @RequirePermission('categories:read')
  @Get(':id/page')
  findPage(@Param('id') id: string, @Query() query: FindPageDto) {
    return this.categoriesService.findPage(id, query.pageSize);
  }

  @RequirePermission('categories:delete')
  @Get('trash')
  findTrashed(@Query() query: QueryCategoryDto) {
    return this.categoriesService.findTrashed(query);
  }

  @RequirePermission('categories:read')
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.categoriesService.findOne(id);
  }

  // Öffentlich wie die anderen Vorschau-/Feed-Auslieferungen dieser App
  // (z.B. GET /content/preview/:token) – ein RSS-Feed ist per Definition
  // ohne Login abrufbar, sonst könnte ihn kein Feed-Reader abonnieren.
  @Public()
  @Get(':id/feed.xml')
  @Header('Content-Type', 'application/rss+xml; charset=utf-8')
  async feed(@Param('id') id: string) {
    const xml = await this.categoriesService.generateFeed(id);
    if (!xml) {
      throw new NotFoundException('Kein RSS-Feed für diese Kategorie.');
    }
    return xml;
  }

  @RequirePermission('categories:create')
  @Post()
  create(@Body() dto: CreateCategoryDto) {
    return this.categoriesService.create(dto);
  }

  @RequirePermission('categories:update')
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateCategoryDto) {
    return this.categoriesService.update(id, dto);
  }

  @RequirePermission('categories:delete')
  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.categoriesService.remove(id, user.sub);
  }

  @RequirePermission('categories:delete')
  @Post(':id/restore')
  restore(@Param('id') id: string) {
    return this.categoriesService.restore(id);
  }

  @RequirePermission('categories:delete')
  @Delete(':id/permanent')
  permanentDelete(@Param('id') id: string) {
    return this.categoriesService.permanentDelete(id);
  }
}
