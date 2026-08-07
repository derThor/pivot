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

// Webhooks sind Admin-Konfiguration (analog zu den anderen Site-weiten
// Einstellungen), keine eigene Ressource mit granularen Rechten – gegated
// über dieselbe `settings:manage`-Permission wie der Rest von /settings.
@ApiTags('webhooks')
@ApiBearerAuth()
@RequirePermission('settings:manage')
@Controller('webhooks')
export class WebhooksController {
  constructor(private readonly webhooksService: WebhooksService) {}

  @Get()
  findAll(@Query() query: QueryWebhookDto) {
    return this.webhooksService.findAll(query);
  }

  @Post()
  create(@Body() dto: CreateWebhookDto) {
    return this.webhooksService.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateWebhookDto) {
    return this.webhooksService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.webhooksService.remove(id);
  }
}
