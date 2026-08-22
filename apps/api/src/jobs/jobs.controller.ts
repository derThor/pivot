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
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JobsService } from './jobs.service';
import { UpdateJobDto } from './dto/update-job.dto';
import { QueryJobRunsDto } from './dto/query-job-runs.dto';
import { QueryJobsDto } from './dto/query-jobs.dto';
import { RequirePermission } from '../auth/decorators/permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/strategies/jwt.strategy';

// "Jobs"-Reiter unter Einstellungen (Nutzervorgabe, 2026-08-22). Gleiches
// Recht wie der Rest der Einstellungen-Seite (`settings:*`, Pivot-
// exklusiv wie Webhooks/Integrationen) – kein eigenes Recht, siehe
// Rückfrage im Chat.
@ApiTags('jobs')
@ApiBearerAuth()
@Controller('jobs')
export class JobsController {
  constructor(private readonly jobsService: JobsService) {}

  @RequirePermission('settings:read')
  @Get()
  findAll(@Query() query: QueryJobsDto) {
    return this.jobsService.findAll(query.page, query.pageSize);
  }

  // Vor `:id`-Routen in der Datei nicht relevant, da eigener Pfad
  // (`/jobs/runs` vs. `/jobs/:id`) – Express/Nest matchen hier eindeutig.
  @RequirePermission('settings:read')
  @Get('runs')
  findRecentRuns(@Query() query: QueryJobRunsDto) {
    return this.jobsService.findRecentRuns(query.page, query.pageSize);
  }

  @RequirePermission('settings:read')
  @Get(':id/runs')
  findRunsForJob(@Param('id') id: string, @Query() query: QueryJobRunsDto) {
    return this.jobsService.findRunsForJob(id, query.page, query.pageSize);
  }

  // "Alle löschen" bei "Letzte Läufe" (Nutzervorgabe, 2026-08-22) – vor
  // `:id`-Routen in der Datei nicht relevant, eigener Pfad `/jobs/runs`.
  @RequirePermission('settings:update')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete('runs')
  deleteAllRuns(@CurrentUser() user: JwtPayload) {
    return this.jobsService.deleteAllRuns(user.sub);
  }

  @RequirePermission('settings:update')
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateJobDto) {
    return this.jobsService.update(id, dto);
  }

  @RequirePermission('settings:update')
  @HttpCode(HttpStatus.OK)
  @Post(':id/run')
  runNow(@Param('id') id: string) {
    return this.jobsService.runNow(id);
  }
}
