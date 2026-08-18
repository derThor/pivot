import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ContentStatus } from '@pivot/database';
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

  // Veröffentlichen/Planen sind eigene Rechte über `content:create`/`update`
  // hinaus (z.B. "Redakteur": darf planen, aber nicht direkt veröffentlichen
  // – siehe packages/database/prisma/seed.ts). `status` steckt im generischen
  // Create/Update-DTO, es gibt keine eigenen Publish/Schedule-Endpoints,
  // daher hier manuell geprüft statt per `@RequirePermission`.
  private assertStatusPermission(user: JwtPayload, status?: ContentStatus) {
    if (
      status === ContentStatus.PUBLISHED &&
      !user.permissions.includes('content:publish')
    ) {
      throw new ForbiddenException('Fehlende Berechtigung: content:publish');
    }
    if (
      status === ContentStatus.SCHEDULED &&
      !user.permissions.includes('content:schedule')
    ) {
      throw new ForbiddenException('Fehlende Berechtigung: content:schedule');
    }
  }

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

  @RequirePermission('content:delete')
  @Get('trash')
  findTrashed(@Query() query: QueryContentDto) {
    return this.contentService.findTrashed(query);
  }

  @Public()
  @Get('preview/:token')
  findByPreviewToken(@Param('token') token: string) {
    return this.contentService.findByPreviewToken(token);
  }

  @RequirePermission('preview-links:read')
  @Get('preview-links')
  findAllPreviewLinks(@Query() query: QueryPreviewLinksDto) {
    return this.contentService.findAllPreviewLinks(query);
  }

  @RequirePermission('preview-links:read')
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
    this.assertStatusPermission(user, dto.status);
    return this.contentService.create(dto, user.sub);
  }

  @RequirePermission('content:update')
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateContentDto,
    @CurrentUser() user: JwtPayload,
  ) {
    this.assertStatusPermission(user, dto.status);
    return this.contentService.update(id, dto, user.sub);
  }

  @RequirePermission('content:delete')
  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.contentService.remove(id, user.sub);
  }

  @RequirePermission('content:delete')
  @Post(':id/restore')
  restore(@Param('id') id: string) {
    return this.contentService.restore(id);
  }

  @RequirePermission('content:delete')
  @Delete(':id/permanent')
  permanentDelete(@Param('id') id: string) {
    return this.contentService.permanentDelete(id);
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

  @RequirePermission('preview-links:read')
  @Get(':id/preview-links')
  findPreviewLinks(@Param('id') id: string) {
    return this.contentService.findPreviewLinks(id);
  }

  @RequirePermission('preview-links:create')
  @Post(':id/preview-links')
  createPreviewLink(
    @Param('id') id: string,
    @Body() dto: CreatePreviewLinkDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.contentService.createPreviewLink(id, user.sub, dto);
  }

  // Verlängert nur die Gültigkeit eines bestehenden Links (kein separates
  // Recht im Katalog dafür) – fachlich dieselbe Fähigkeit wie einen neuen
  // Link auszustellen, deshalb `preview-links:create`.
  @RequirePermission('preview-links:create')
  @Patch(':id/preview-links/:linkId')
  updatePreviewLink(
    @Param('id') id: string,
    @Param('linkId') linkId: string,
    @Body() dto: UpdatePreviewLinkDto,
  ) {
    return this.contentService.updatePreviewLink(id, linkId, dto);
  }

  @RequirePermission('preview-links:revoke')
  @Delete(':id/preview-links/:linkId')
  revokePreviewLink(@Param('id') id: string, @Param('linkId') linkId: string) {
    return this.contentService.revokePreviewLink(id, linkId);
  }
}
