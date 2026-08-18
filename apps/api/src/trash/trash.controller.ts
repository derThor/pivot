import {
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { TrashService } from './trash.service';
import { QueryTrashDto } from './dto/query-trash.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/strategies/jwt.strategy';
import { TRASH_TYPES } from './trash.types';
import type { TrashType } from './trash.types';

// Eine Route deckt sechs Ressourcen ab, daher hier – analog zu
// GlobalModulesController – manuelle statt statischer `@RequirePermission`-
// Prüfung: `GET /trash` zeigt jedem nur die Typen, für die er `:read` hat
// (sonst würde z.B. ein Nutzer mit nur `tags:read` auch fremde gelöschte
// Seiten/Medien sehen), Mutationen prüfen `${type}:delete` pro Aufruf.
@ApiTags('trash')
@ApiBearerAuth()
@Controller('trash')
export class TrashController {
  constructor(private readonly trashService: TrashService) {}

  private readableTypes(user: JwtPayload): TrashType[] {
    return TRASH_TYPES.filter((type) =>
      user.permissions.includes(`${type}:read`),
    );
  }

  private deletableTypes(user: JwtPayload): TrashType[] {
    return TRASH_TYPES.filter((type) =>
      user.permissions.includes(`${type}:delete`),
    );
  }

  private assertDeleteAccess(user: JwtPayload, type: TrashType) {
    if (!user.permissions.includes(`${type}:delete`)) {
      throw new ForbiddenException(`Fehlende Berechtigung: ${type}:delete`);
    }
  }

  @Get()
  findAll(@Query() query: QueryTrashDto, @CurrentUser() user: JwtPayload) {
    const types = this.readableTypes(user);
    if (types.length === 0) {
      throw new ForbiddenException('Fehlende Berechtigung für den Papierkorb.');
    }
    if (query.type && !types.includes(query.type)) {
      throw new ForbiddenException(`Fehlende Berechtigung: ${query.type}:read`);
    }
    return this.trashService.list({ types, type: query.type, q: query.q });
  }

  @Post(':type/:id/restore')
  restore(
    @Param('type') type: TrashType,
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    this.assertDeleteAccess(user, type);
    return this.trashService.restore(type, id);
  }

  @Delete(':type/:id')
  remove(
    @Param('type') type: TrashType,
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    this.assertDeleteAccess(user, type);
    return this.trashService.permanentDelete(type, id);
  }

  @Delete()
  removeAll(@CurrentUser() user: JwtPayload) {
    const types = this.deletableTypes(user);
    if (types.length === 0) {
      throw new ForbiddenException('Fehlende Berechtigung für den Papierkorb.');
    }
    return this.trashService.emptyAll(types);
  }

  @Post('restore-expiring')
  restoreExpiring(@CurrentUser() user: JwtPayload) {
    const types = this.deletableTypes(user);
    if (types.length === 0) {
      throw new ForbiddenException('Fehlende Berechtigung für den Papierkorb.');
    }
    return this.trashService.restoreExpiring(types);
  }
}
