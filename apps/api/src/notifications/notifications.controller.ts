import { Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { NotificationsService } from './notifications.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/strategies/jwt.strategy';

// Bewusst ohne @RequirePermission: jeder eingeloggte Nutzer sieht sein
// eigenes Postfach (gleiches Muster wie /auth/me) – welche Kategorien
// darin überhaupt auftauchen können, filtert `NotificationsService.sync()`
// bereits anhand der Berechtigungen des Nutzers.
@ApiTags('notifications')
@ApiBearerAuth()
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  findAll(@CurrentUser() user: JwtPayload) {
    return this.notificationsService.findAll(user);
  }

  @Post(':id/read')
  markRead(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.notificationsService.markRead(id, user.sub);
  }

  @Post(':id/unread')
  markUnread(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.notificationsService.markUnread(id, user.sub);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.notificationsService.remove(id, user.sub);
  }

  @Post('read-all')
  markAllRead(@CurrentUser() user: JwtPayload) {
    return this.notificationsService.markAllRead(user.sub);
  }

  @Post(':id/resolve')
  markResolved(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.notificationsService.markResolved(id, user.sub);
  }
}
