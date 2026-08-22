import {
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Param,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PrivacyService } from './privacy.service';
import { RequirePermission } from '../auth/decorators/permissions.decorator';

@ApiTags('privacy')
@ApiBearerAuth()
@Controller('privacy')
export class PrivacyController {
  constructor(private readonly privacyService: PrivacyService) {}

  @RequirePermission('privacy:read')
  @Get('retention/access-log')
  findAccessLogDue() {
    return this.privacyService.findAccessLogDue();
  }

  @RequirePermission('privacy:delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete('retention/access-log/:id')
  deleteAccessLogEntry(@Param('id') id: string) {
    return this.privacyService.deleteAccessLogEntry(id);
  }

  @RequirePermission('privacy:delete')
  @Delete('retention/access-log')
  deleteAllAccessLogDue() {
    return this.privacyService.deleteAllAccessLogDue();
  }

  @RequirePermission('privacy:read')
  @Get('retention/deactivated-accounts')
  findDeactivatedAccountsDue() {
    return this.privacyService.findDeactivatedAccountsDue();
  }

  @RequirePermission('privacy:read')
  @Get('retention/trash')
  findTrashDue() {
    return this.privacyService.findTrashDue();
  }

  @RequirePermission('privacy:read')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="dsgvo-bericht.csv"')
  @Get('report')
  async generateReport() {
    return this.privacyService.generateReportCsv();
  }

  @RequirePermission('privacy:read')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="auskunft.csv"')
  @Get('subject-access-report/:userId')
  async generateSubjectAccessReport(@Param('userId') userId: string) {
    return this.privacyService.generateSubjectAccessReportCsv(userId);
  }

  @RequirePermission('privacy:read')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Post('subject-access-report/:userId/send')
  async sendSubjectAccessReport(@Param('userId') userId: string) {
    await this.privacyService.sendSubjectAccessReport(userId);
  }
}
