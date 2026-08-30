import {
  Body,
  Controller,
  Delete,
  forwardRef,
  Get,
  Header,
  Headers,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { QueryUserDto } from './dto/query-user.dto';
import { QueryActivityDto } from './dto/query-activity.dto';
import { RequirePermission } from '../auth/decorators/permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { FindPageDto } from '../common/dto/find-page.dto';
import type { JwtPayload } from '../auth/strategies/jwt.strategy';
import { AuthService } from '../auth/auth.service';

@ApiTags('users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    @Inject(forwardRef(() => AuthService))
    private readonly authService: AuthService,
  ) {}

  @RequirePermission('users:read')
  @Get()
  findAll(@Query() query: QueryUserDto) {
    return this.usersService.findAll(query);
  }

  // Vor `:id` registriert (Express matcht Routen in Reihenfolge) – sonst
  // würde "notification-counts" als `:id` interpretiert.
  @RequirePermission('users:read')
  @Get('notification-counts')
  getNotificationCounts() {
    return this.usersService.getNotificationCounts();
  }

  @RequirePermission('users:read')
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.usersService.findOne(id);
  }

  @RequirePermission('users:read')
  @Get(':id/page')
  findPage(@Param('id') id: string, @Query() query: FindPageDto) {
    return this.usersService.findPage(id, query.pageSize);
  }

  @RequirePermission('users:read')
  @Get(':id/stats')
  getStats(@Param('id') id: string) {
    return this.usersService.getStats(id);
  }

  @RequirePermission('users:read')
  @Get(':id/activity')
  getActivity(@Param('id') id: string, @Query() query: QueryActivityDto) {
    return this.usersService.getActivity(id, query.page, query.pageSize);
  }

  // CSV-Export des Aktivitätsverlaufs (Nutzervorgabe, 2026-08-30: "bei
  // benutzer aktivitäten als export ermöglichen") – gleiches Muster wie
  // SettingsController.exportSettingsChanges().
  @RequirePermission('users:read')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="aktivitaet.csv"')
  @Get(':id/activity/export')
  exportActivity(@Param('id') id: string) {
    return this.usersService.exportActivityCsv(id);
  }

  // Kein admin-vergebenes Passwort mehr (Nutzervorgabe, 2026-08-17):
  // usersService.create() setzt einen zufälligen, nie offengelegten Hash;
  // hier wird direkt der bestehende Passwort-Reset-Link verschickt, über
  // den der neue Nutzer sein eigenes Passwort setzt (gleicher Mechanismus
  // wie der "Passwort zurücksetzen"-Button, siehe adminRequestPasswordReset).
  @RequirePermission('users:invite')
  @Post()
  async create(@Body() dto: CreateUserDto, @CurrentUser() user: JwtPayload) {
    const created = await this.usersService.create(dto, user);
    await this.authService.adminRequestPasswordReset(created.id);
    return created;
  }

  @RequirePermission('users:update')
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.usersService.update(id, dto, user);
  }

  // Soft-Delete (setzt `isActive: false`, siehe UsersService.remove) – als
  // eigenes `users:deactivate` statt `users:update`, weil das
  // administrative Recht "jemandem den Zugriff entziehen" unabhängig von
  // reinen Profil-Änderungen vergeben werden soll.
  @RequirePermission('users:deactivate')
  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.usersService.remove(id, user.sub);
  }

  // "Nutzer löschen" (Bearbeiten-Seite): verschwindet aus der Benutzer-
  // liste, taucht unter Datenschutz → "Nutzer" auf. Eigenes, restriktiveres
  // Recht wie `anonymize` – beides sind Schritte derselben Löschpipeline.
  @RequirePermission('users:delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Post(':id/delete')
  delete(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.usersService.delete(id, user.sub);
  }

  // Bewusst eigenes, restriktiveres Recht statt `users:deactivate` – siehe
  // knowledge-base/auth/rbac-rework.md, Update 2026-08-16: Anonymisierung
  // ist nicht reversibel. Nur noch von Datenschutz → "Nutzer" aus
  // auslösbar (Nutzervorgabe 2026-08-21), nicht mehr direkt von der
  // Benutzer-Bearbeiten-Seite.
  @RequirePermission('users:delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Post(':id/anonymize')
  anonymize(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.usersService.anonymize(id, user.sub);
  }

  // Macht delete() rückgängig – gleiches Recht wie delete/anonymize, da
  // Teil derselben Löschpipeline.
  @RequirePermission('users:delete')
  @Post(':id/restore')
  restore(@Param('id') id: string) {
    return this.usersService.restore(id);
  }

  @RequirePermission('users:impersonate')
  @HttpCode(HttpStatus.OK)
  @Post(':id/impersonate')
  impersonate(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.authService.impersonate(user, id);
  }

  @RequirePermission('users:update')
  @HttpCode(HttpStatus.OK)
  @Post(':id/reset-password')
  resetPassword(@Param('id') id: string) {
    return this.authService.adminRequestPasswordReset(id);
  }

  // Notausgang bei Geräteverlust ohne gültigen Recovery-Code (2026-08-17,
  // siehe UsersService.disableTwoFactor()).
  @RequirePermission('users:update')
  @HttpCode(HttpStatus.OK)
  @Post(':id/disable-2fa')
  disableTwoFactor(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.usersService.disableTwoFactor(id, user.sub);
  }

  // `x-current-refresh-token`: das Frontend hängt hier den eigenen
  // Refresh-Token-Cookie-Wert an, damit die eigene Sitzung als "aktuelle
  // Sitzung" markiert werden kann (nur relevant, wenn `id` der eigenen
  // Nutzer-ID entspricht). Absichtlich Header statt Query-Param, damit der
  // Token nicht in Server-/Proxy-Logs landet.
  @RequirePermission('users:update')
  @Get(':id/sessions')
  listSessions(
    @Param('id') id: string,
    @Headers('x-current-refresh-token') currentRefreshToken?: string,
  ) {
    return this.authService.listSessions(id, currentRefreshToken);
  }

  @RequirePermission('users:update')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete(':id/sessions/:sessionId')
  revokeSession(
    @Param('id') id: string,
    @Param('sessionId') sessionId: string,
  ) {
    return this.authService.revokeSession(id, sessionId);
  }

  @RequirePermission('users:update')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Post(':id/sessions/revoke-others')
  revokeOtherSessions(
    @Param('id') id: string,
    @Headers('x-current-refresh-token') currentRefreshToken?: string,
  ) {
    return this.authService.revokeOtherSessions(id, currentRefreshToken);
  }
}
