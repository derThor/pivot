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

// Vormals eigenes `webhooks`-Rechte-Bündel (Rollen-&-Rechte-Neubau,
// 2026-08-16), seit Webhooks unter Einstellungen leben wieder auf
// `settings:*` konsolidiert (Nutzervorgabe, 2026-08-21: "webhooks
// brauchen keine eigenen rechte mehr, soll komplett über einstellungen
// gehen") – kein separates Rechte-Bündel mehr für eine Unterseite, die es
// als eigene Seite nicht mehr gibt.
@ApiTags('webhooks')
@ApiBearerAuth()
@Controller('webhooks')
export class WebhooksController {
  constructor(private readonly webhooksService: WebhooksService) {}

  @RequirePermission('settings:read')
  @Get()
  findAll(@Query() query: QueryWebhookDto) {
    return this.webhooksService.findAll(query);
  }

  @RequirePermission('settings:update')
  @Post()
  create(@Body() dto: CreateWebhookDto) {
    return this.webhooksService.create(dto);
  }

  @RequirePermission('settings:update')
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateWebhookDto) {
    return this.webhooksService.update(id, dto);
  }

  @RequirePermission('settings:update')
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.webhooksService.remove(id);
  }
}
