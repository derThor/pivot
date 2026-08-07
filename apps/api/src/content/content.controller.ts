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
import { ContentService } from './content.service';
import { CreateContentDto } from './dto/create-content.dto';
import { UpdateContentDto } from './dto/update-content.dto';
import { QueryContentDto } from './dto/query-content.dto';
import { QueryContentVersionsDto } from './dto/query-content-versions.dto';
import { SearchContentDto } from './dto/search-content.dto';
import { CreatePreviewLinkDto } from './dto/create-preview-link.dto';
import { UpdatePreviewLinkDto } from './dto/update-preview-link.dto';
import { QueryPreviewLinksDto } from './dto/query-preview-links.dto';
import { FindPageDto } from '../common/dto/find-page.dto';
import { RequirePermission } from '../auth/decorators/permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Public } from '../auth/decorators/public.decorator';
import type { JwtPayload } from '../auth/strategies/jwt.strategy';

@ApiTags('content')
@ApiBearerAuth()
@Controller('content')
export class ContentController {
  constructor(private readonly contentService: ContentService) {}

  @RequirePermission('content:read')
  @Get()
  findAll(@Query() query: QueryContentDto) {
    return this.contentService.findAll(query);
  }

  @RequirePermission('content:read')
  @Get('search')
  search(@Query() query: SearchContentDto) {
    return this.contentService.search(query.q, query.limit);
  }

  @Public()
  @Get('preview/:token')
  findByPreviewToken(@Param('token') token: string) {
    return this.contentService.findByPreviewToken(token);
  }

  @RequirePermission('content:read')
  @Get('preview-links')
  findAllPreviewLinks(@Query() query: QueryPreviewLinksDto) {
    return this.contentService.findAllPreviewLinks(query);
  }

  @RequirePermission('content:read')
  @Get('preview-links/:linkId/page')
  findPreviewLinkPage(
    @Param('linkId') linkId: string,
    @Query() query: FindPageDto,
  ) {
    return this.contentService.findPreviewLinkPage(linkId, query.pageSize);
  }

  @RequirePermission('content:read')
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.contentService.findOne(id);
  }

  @RequirePermission('content:create')
  @Post()
  create(@Body() dto: CreateContentDto, @CurrentUser() user: JwtPayload) {
    return this.contentService.create(dto, user.sub);
  }

  @RequirePermission('content:update')
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateContentDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.contentService.update(id, dto, user.sub);
  }

  @RequirePermission('content:delete')
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.contentService.remove(id);
  }

  @RequirePermission('content:update')
  @Get(':id/versions')
  findVersions(
    @Param('id') id: string,
    @Query() query: QueryContentVersionsDto,
  ) {
    return this.contentService.findVersions(id, query);
  }

  @RequirePermission('content:update')
  @Post(':id/versions/:versionId/rollback')
  rollback(
    @Param('id') id: string,
    @Param('versionId') versionId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.contentService.rollback(id, versionId, user.sub);
  }

  @RequirePermission('content:update')
  @Delete(':id/versions/:versionId')
  removeVersion(
    @Param('id') id: string,
    @Param('versionId') versionId: string,
  ) {
    return this.contentService.removeVersion(id, versionId);
  }

  @RequirePermission('content:update')
  @Post(':id/lock')
  lock(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.contentService.lock(id, user.sub);
  }

  @RequirePermission('content:update')
  @Post(':id/unlock')
  unlock(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.contentService.unlock(
      id,
      user.sub,
      user.permissions.includes('content:delete'),
    );
  }

  @RequirePermission('content:read')
  @Get(':id/preview-links')
  findPreviewLinks(@Param('id') id: string) {
    return this.contentService.findPreviewLinks(id);
  }

  @RequirePermission('content:read')
  @Post(':id/preview-links')
  createPreviewLink(
    @Param('id') id: string,
    @Body() dto: CreatePreviewLinkDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.contentService.createPreviewLink(id, user.sub, dto);
  }

  @RequirePermission('content:read')
  @Patch(':id/preview-links/:linkId')
  updatePreviewLink(
    @Param('id') id: string,
    @Param('linkId') linkId: string,
    @Body() dto: UpdatePreviewLinkDto,
  ) {
    return this.contentService.updatePreviewLink(id, linkId, dto);
  }

  @RequirePermission('content:read')
  @Delete(':id/preview-links/:linkId')
  revokePreviewLink(
    @Param('id') id: string,
    @Param('linkId') linkId: string,
  ) {
    return this.contentService.revokePreviewLink(id, linkId);
  }
}
