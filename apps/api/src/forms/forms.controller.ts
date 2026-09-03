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
  Query,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { FormsService } from './forms.service';
import { CreateFormDto } from './dto/create-form.dto';
import { UpdateFormDto } from './dto/update-form.dto';
import { QueryFormDto } from './dto/query-form.dto';
import { QuerySubmissionsDto } from './dto/query-submissions.dto';
import { UpdateSubmissionDto } from './dto/update-submission.dto';
import { SubmitFormDto } from './dto/submit-form.dto';
import { RequirePermission } from '../auth/decorators/permissions.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/strategies/jwt.strategy';

// Gleicher Grund wie in auth.controller.ts: `POST /:slug/submit` läuft über
// die Next.js-BFF-Route (server-seitiger `fetch()`), `req.ip` wäre sonst
// die interne Adresse des Next.js-Servers statt die des echten Browsers.
function clientIp(req: Request): string | null {
  const forwardedFor = req.headers['x-forwarded-for'];
  const forwardedIp = Array.isArray(forwardedFor)
    ? forwardedFor[0]
    : forwardedFor?.split(',')[0]?.trim();
  return forwardedIp || req.ip || null;
}

@ApiTags('forms')
@Controller('forms')
export class FormsController {
  constructor(private readonly formsService: FormsService) {}

  @ApiBearerAuth()
  @RequirePermission('forms:read')
  @Get()
  findAll(@Query() query: QueryFormDto) {
    return this.formsService.findAll(query);
  }

  @ApiBearerAuth()
  @RequirePermission('forms:delete')
  @Get('trash')
  findTrashed() {
    return this.formsService.findAllTrashed();
  }

  @ApiBearerAuth()
  @RequirePermission('forms:read')
  @Get('stats')
  getStats() {
    return this.formsService.getStats();
  }

  // App-weite Einsendungen-Sammelübersicht – muss vor `:id` stehen, sonst
  // würde Nest "submissions" als `:id` interpretieren.
  @ApiBearerAuth()
  @RequirePermission('form-submissions:read')
  @Get('submissions')
  allSubmissions(@Query() query: QuerySubmissionsDto) {
    return this.formsService.allSubmissions(query);
  }

  // Zähler für das Briefsymbol in der Kopfzeile (Nutzervorgabe,
  // 2026-09-03). Eigener, sehr schlanker Endpunkt statt einer Zahl an der
  // Listen-Antwort: die Kopfzeile lädt bei JEDEM Seitenaufruf, sie soll
  // dafür keine Seite voller Einsendungen mitziehen.
  @ApiBearerAuth()
  @RequirePermission('form-submissions:read')
  @Get('submissions/unread-count')
  unreadSubmissionCount() {
    return this.formsService.countUnreadSubmissions();
  }

  // Öffentlicher Formular-Baustein im Seiten-Designer – muss vor `:id`
  // stehen, sonst würde Nest "public" als `:id` interpretieren.
  @Public()
  @Get('public/:id')
  findPublicById(@Param('id') id: string) {
    return this.formsService.findPublicById(id);
  }

  @ApiBearerAuth()
  @RequirePermission('forms:read')
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.formsService.findOne(id);
  }

  @ApiBearerAuth()
  @RequirePermission('form-submissions:read')
  @Get(':id/submissions')
  submissions(@Param('id') id: string, @Query() query: QuerySubmissionsDto) {
    return this.formsService.submissions(id, query);
  }

  @ApiBearerAuth()
  @RequirePermission('forms:create')
  @Post()
  create(@Body() dto: CreateFormDto) {
    return this.formsService.create(dto);
  }

  @ApiBearerAuth()
  @RequirePermission('forms:update')
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateFormDto) {
    return this.formsService.update(id, dto);
  }

  @ApiBearerAuth()
  @RequirePermission('forms:delete')
  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.formsService.remove(id, user.sub);
  }

  @ApiBearerAuth()
  @RequirePermission('forms:delete')
  @Post(':id/restore')
  restore(@Param('id') id: string) {
    return this.formsService.restore(id);
  }

  @ApiBearerAuth()
  @RequirePermission('forms:delete')
  @Delete(':id/permanent')
  permanentDelete(@Param('id') id: string) {
    return this.formsService.permanentDelete(id);
  }

  @ApiBearerAuth()
  @RequirePermission('form-submissions:delete')
  @Patch(':id/submissions/:submissionId')
  markSubmissionRead(
    @Param('id') id: string,
    @Param('submissionId') submissionId: string,
    @Body() dto: UpdateSubmissionDto,
  ) {
    return this.formsService.markSubmissionRead(id, submissionId, dto.isRead);
  }

  @ApiBearerAuth()
  @RequirePermission('form-submissions:delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete(':id/submissions/:submissionId')
  deleteSubmission(
    @Param('id') id: string,
    @Param('submissionId') submissionId: string,
  ) {
    return this.formsService.deleteSubmission(id, submissionId);
  }

  @Public()
  @HttpCode(HttpStatus.OK)
  @Post(':slug/submit')
  submit(
    @Param('slug') slug: string,
    @Body() dto: SubmitFormDto,
    @Req() req: Request,
  ) {
    return this.formsService.submit(slug, dto.values, clientIp(req));
  }
}
