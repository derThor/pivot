import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { DeletionRequestsService } from './deletion-requests.service';
import { CreateDeletionRequestDto } from './dto/create-deletion-request.dto';
import { UpdateDeletionRequestDto } from './dto/update-deletion-request.dto';
import { SendFollowUpDto } from './dto/send-follow-up.dto';
import { CreateSelfServiceRequestDto } from './dto/create-self-service-request.dto';
import { CreatePublicRequestDto } from './dto/create-public-request.dto';
import { Public } from '../auth/decorators/public.decorator';
import { RequirePermission } from '../auth/decorators/permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/strategies/jwt.strategy';
import { RequireModule } from '../license-client/decorators/require-module.decorator';
import { RequireModuleFeature } from '../license-client/decorators/require-module-feature.decorator';
import { ModuleEntitlementGuard } from '../license-client/guards/module-entitlement.guard';
import { ModuleFeatureGuard } from '../license-client/guards/module-feature.guard';

// Datenschutz-als-Modul (Nutzervorgabe, 2026-08-28): Reiter "Anfragen" –
// NUR die Admin-Routen unten bekommen `@RequireModule`/
// `@RequireModuleFeature` einzeln (nicht auf Klassenebene!), die
// Self-Service-Routen (`self-service`/`self-service/:id`) bleiben für
// jeden eingeloggten Nutzer unverändert erreichbar, unabhängig von der
// Modul-Buchung – Selbstauskunft/-löschung ist keine Admin-Funktion.
@ApiTags('deletion-requests')
@ApiBearerAuth()
@Controller('deletion-requests')
export class DeletionRequestsController {
  constructor(
    private readonly deletionRequestsService: DeletionRequestsService,
  ) {}

  @UseGuards(ModuleEntitlementGuard, ModuleFeatureGuard)
  @RequireModule('datenschutz')
  @RequireModuleFeature('datenschutz', 'loeschanfragen')
  @RequirePermission('privacy:read')
  @Get()
  findAll() {
    return this.deletionRequestsService.findAll();
  }

  @UseGuards(ModuleEntitlementGuard, ModuleFeatureGuard)
  @RequireModule('datenschutz')
  @RequireModuleFeature('datenschutz', 'loeschanfragen')
  @RequirePermission('privacy:create')
  @Post()
  create(@Body() dto: CreateDeletionRequestDto) {
    return this.deletionRequestsService.create(dto);
  }

  /** Selbstauskunft aus dem Formular-Footer der öffentlichen Website
   * (Nutzervorgabe, 2026-09-02). Anders als `self-service` ohne Login –
   * ein Website-Besucher hat kein Konto, und ein Betroffenenrecht darf
   * nicht davon abhängen, ob man hier Kunde ist.
   *
   * Die Antwort ist bewusst immer dieselbe und enthält keinerlei Daten
   * (siehe `createFromPublicForm()`). Eng gedrosselt: der Endpunkt ist
   * offen, legt Datenbankzeilen an und verschickt eventuell eine
   * Bestätigungsmail – ohne Deckel wäre er ein Spam-Werkzeug. Gleiche
   * Größenordnung wie die Login-Routen (auth.controller.ts). */
  @Public()
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @Post('public')
  createFromPublicForm(@Body() dto: CreatePublicRequestDto) {
    return this.deletionRequestsService.createFromPublicForm(
      dto.email,
      dto.note,
    );
  }

  // Bewusst KEIN @RequirePermission: Selbstauskunft/-löschung aus dem
  // eigenen Konto heraus (Nutzervorgabe, 2026-08-19) – jeder eingeloggte
  // Nutzer darf eine Anfrage zu sich selbst stellen, das ist keine
  // Admin-Funktion. `JwtAuthGuard` (global via APP_GUARD) verlangt
  // trotzdem einen gültigen Login. Backend jetzt, Frontend-Einstiegspunkt
  // (Mein Konto) folgt später.
  @Post('self-service')
  createSelfService(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateSelfServiceRequestDto,
  ) {
    return this.deletionRequestsService.createSelfService(user.sub, dto);
  }

  // Ebenfalls bewusst ohne @RequirePermission – "Meine Daten" zeigt dem
  // Nutzer seine eigenen, bereits gestellten Anfragen (Nutzervorgabe:
  // "wenn ich eine anfrage anklicke, will ich ein popup mit allen infos
  // zur anfrage").
  @Get('self-service')
  findMine(@CurrentUser() user: JwtPayload) {
    return this.deletionRequestsService.findMineForUser(user.sub);
  }

  // "Anfrage zurückziehen" (Nutzervorgabe, 2026-08-19) – Ownership-Prüfung
  // (nur die eigene Anfrage) passiert im Service, nicht hier.
  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete('self-service/:id')
  withdrawSelfService(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.deletionRequestsService.withdrawSelfService(id, user.sub);
  }

  @UseGuards(ModuleEntitlementGuard, ModuleFeatureGuard)
  @RequireModule('datenschutz')
  @RequireModuleFeature('datenschutz', 'loeschanfragen')
  @RequirePermission('privacy:update')
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateDeletionRequestDto) {
    return this.deletionRequestsService.update(id, dto);
  }

  @UseGuards(ModuleEntitlementGuard, ModuleFeatureGuard)
  @RequireModule('datenschutz')
  @RequireModuleFeature('datenschutz', 'loeschanfragen')
  @RequirePermission('privacy:delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.deletionRequestsService.remove(id);
  }

  @UseGuards(ModuleEntitlementGuard, ModuleFeatureGuard)
  @RequireModule('datenschutz')
  @RequireModuleFeature('datenschutz', 'loeschanfragen')
  @RequirePermission('privacy:read')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="datenauszug.csv"')
  @Get(':id/data-extract')
  generateDataExtract(@Param('id') id: string) {
    return this.deletionRequestsService.generateDataExtract(id);
  }

  @UseGuards(ModuleEntitlementGuard, ModuleFeatureGuard)
  @RequireModule('datenschutz')
  @RequireModuleFeature('datenschutz', 'loeschanfragen')
  @RequirePermission('privacy:update')
  @Post(':id/complete')
  markCompleted(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.deletionRequestsService.markCompleted(id, user.sub);
  }

  @UseGuards(ModuleEntitlementGuard, ModuleFeatureGuard)
  @RequireModule('datenschutz')
  @RequireModuleFeature('datenschutz', 'loeschanfragen')
  @RequirePermission('privacy:update')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Post(':id/follow-up')
  sendFollowUp(@Param('id') id: string, @Body() dto: SendFollowUpDto) {
    return this.deletionRequestsService.sendFollowUp(id, dto.message);
  }
}
