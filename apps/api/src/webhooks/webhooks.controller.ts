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
import { WebhooksService } from './webhooks.service';
import { CreateWebhookDto } from './dto/create-webhook.dto';
import { UpdateWebhookDto } from './dto/update-webhook.dto';
import { QueryWebhookDto } from './dto/query-webhook.dto';
import { RequirePermission } from '../auth/decorators/permissions.decorator';

// Eigenes `webhooks`-Rechte-Bündel statt des groben `settings:manage`
// (Rollen-&-Rechte-Neubau, 2026-08-16, siehe
// knowledge-base/auth/rbac-rework.md).
@ApiTags('webhooks')
@ApiBearerAuth()
@Controller('webhooks')
export class WebhooksController {
  constructor(private readonly webhooksService: WebhooksService) {}

  @RequirePermission('webhooks:read')
  @Get()
  findAll(@Query() query: QueryWebhookDto) {
    return this.webhooksService.findAll(query);
  }

  @RequirePermission('webhooks:create')
  @Post()
  create(@Body() dto: CreateWebhookDto) {
    return this.webhooksService.create(dto);
  }

  @RequirePermission('webhooks:update')
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateWebhookDto) {
    return this.webhooksService.update(id, dto);
  }

  @RequirePermission('webhooks:delete')
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.webhooksService.remove(id);
  }
}
