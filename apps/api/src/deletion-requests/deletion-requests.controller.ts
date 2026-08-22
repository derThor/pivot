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
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { DeletionRequestsService } from './deletion-requests.service';
import { CreateDeletionRequestDto } from './dto/create-deletion-request.dto';
import { UpdateDeletionRequestDto } from './dto/update-deletion-request.dto';
import { SendFollowUpDto } from './dto/send-follow-up.dto';
import { CreateSelfServiceRequestDto } from './dto/create-self-service-request.dto';
import { RequirePermission } from '../auth/decorators/permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/strategies/jwt.strategy';

@ApiTags('deletion-requests')
@ApiBearerAuth()
@Controller('deletion-requests')
export class DeletionRequestsController {
  constructor(
    private readonly deletionRequestsService: DeletionRequestsService,
  ) {}

  @RequirePermission('privacy:read')
  @Get()
  findAll() {
    return this.deletionRequestsService.findAll();
  }

  @RequirePermission('privacy:create')
  @Post()
  create(@Body() dto: CreateDeletionRequestDto) {
    return this.deletionRequestsService.create(dto);
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

  @RequirePermission('privacy:update')
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateDeletionRequestDto) {
    return this.deletionRequestsService.update(id, dto);
  }

  @RequirePermission('privacy:delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.deletionRequestsService.remove(id);
  }

  @RequirePermission('privacy:read')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="datenauszug.csv"')
  @Get(':id/data-extract')
  generateDataExtract(@Param('id') id: string) {
    return this.deletionRequestsService.generateDataExtract(id);
  }

  @RequirePermission('privacy:update')
  @Post(':id/complete')
  markCompleted(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.deletionRequestsService.markCompleted(id, user.sub);
  }

  @RequirePermission('privacy:update')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Post(':id/follow-up')
  sendFollowUp(@Param('id') id: string, @Body() dto: SendFollowUpDto) {
    return this.deletionRequestsService.sendFollowUp(id, dto.message);
  }
}
