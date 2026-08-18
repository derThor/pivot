import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { LegalDocumentsService } from './legal-documents.service';
import { UpdateLegalDocumentDto } from './dto/update-legal-document.dto';
import { RequirePermission } from '../auth/decorators/permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/strategies/jwt.strategy';

@ApiTags('legal-documents')
@ApiBearerAuth()
@Controller('legal-documents')
export class LegalDocumentsController {
  constructor(private readonly legalDocumentsService: LegalDocumentsService) {}

  @RequirePermission('privacy:read')
  @Get()
  findAll() {
    return this.legalDocumentsService.findAll();
  }

  @RequirePermission('privacy:update')
  @Post(':key/regenerate')
  regenerate(@Param('key') key: string, @CurrentUser() user: JwtPayload) {
    return this.legalDocumentsService.regenerate(key, user.sub);
  }

  @RequirePermission('privacy:update')
  @Patch(':key')
  updateAddendum(
    @Param('key') key: string,
    @Body() dto: UpdateLegalDocumentDto,
  ) {
    return this.legalDocumentsService.updateAddendum(key, dto);
  }
}
