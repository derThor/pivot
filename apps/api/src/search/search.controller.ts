import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { SearchService } from './search.service';
import { GlobalSearchDto } from './dto/global-search.dto';
import { PagedSearchDto } from './dto/paged-search.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/strategies/jwt.strategy';

@ApiTags('search')
@ApiBearerAuth()
@Controller('search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  // Bewusst ohne @RequirePermission: jeder eingeloggte Dashboard-Nutzer
  // darf suchen, welche Bereiche durchsucht werden hängt stattdessen pro
  // Bereich von dessen eigener `:read`-Permission ab (siehe
  // SearchService.search) – ein Nutzer ohne `media:read` bekommt z.B.
  // nie Medien-Treffer, auch über die globale Suche nicht.
  @Get()
  search(@Query() query: GlobalSearchDto, @CurrentUser() user: JwtPayload) {
    return this.searchService.search(query.q, query.limit, user.permissions);
  }

  // Ein einzelner Bereich mit echter Seiten-Pagination (Gesamtzahl +
  // Seite/Seitengröße) – für die Detailsuche-Ergebnisseite, wenn dort in
  // einem Bereich entsprechend viele Treffer anfallen (siehe
  // SearchService.searchPaged).
  @Get('paged')
  searchPaged(@Query() query: PagedSearchDto, @CurrentUser() user: JwtPayload) {
    return this.searchService.searchPaged(
      query.type,
      query.q,
      query.page,
      query.pageSize,
      user.permissions,
    );
  }
}
