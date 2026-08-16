import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ContentService } from '../content/content.service';

export type SearchResultType =
  | 'content'
  | 'category'
  | 'tag'
  | 'media'
  | 'user'
  | 'role'
  | 'previewLink'
  | 'faq'
  | 'gallery';

export interface SearchResult {
  type: SearchResultType;
  id: string;
  title: string;
  subtitle?: string;
  status?: string;
}

export interface PagedSearchResult {
  items: SearchResult[];
  total: number;
}

/**
 * Bündelt die Volltextsuche (`ContentService.search`) mit einfachen
 * `contains`-Suchen über Kategorien, Tags, Medien, Benutzer, Rollen sowie
 * FAQ/Galerie zu einem einheitlichen Ergebnis-Format, das im Frontend pro
 * Treffer den Bereich (`type`) flaggt. Kategorien/Tags/Medien/Benutzer/
 * Rollen/FAQ/Galerie nutzen bewusst kein Postgres-`tsvector` wie der
 * Content-Body – ihre Textfelder sind kurz (Name/Dateiname/E-Mail/
 * Alt-Text), ein einfacher case-insensitiver `contains`-Filter reicht
 * dafür völlig aus.
 *
 * Zwei Betriebsarten:
 * - `search()`: "Top N je Bereich" für Dropdown/Command-Palette (schnelle
 *   Vorschau über alle Bereiche gleichzeitig, keine Gesamtzahl nötig).
 * - `searchPaged()`: ein einzelner Bereich mit echter Seiten-Pagination
 *   (Gesamtzahl + `skip`/`take`) für die Detailsuche-Ergebnisseite, wenn
 *   dort entsprechend viele Treffer in einem Bereich anfallen.
 */
@Injectable()
export class SearchService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly contentService: ContentService,
  ) {}

  async search(
    q: string,
    limit: number,
    permissions: string[],
  ): Promise<SearchResult[]> {
    const tasks: Promise<SearchResult[]>[] = [];

    if (permissions.includes('content:read')) {
      tasks.push(this.searchContent(q, limit));
      tasks.push(this.searchPreviewLinks(q, limit));
      tasks.push(this.searchGlobalModules(q, limit));
    }
    if (permissions.includes('categories:read')) {
      tasks.push(this.searchCategories(q, limit));
    }
    if (permissions.includes('tags:read')) {
      tasks.push(this.searchTags(q, limit));
    }
    if (permissions.includes('media:read')) {
      tasks.push(this.searchMedia(q, limit));
    }
    if (permissions.includes('users:read')) {
      tasks.push(this.searchUsers(q, limit));
    }
    if (permissions.includes('roles:read')) {
      tasks.push(this.searchRoles(q, limit));
    }

    const results = await Promise.all(tasks);
    return results.flat();
  }

  /** Ein einzelner Bereich mit Gesamtzahl, für die Pagination der
   * Detailsuche-Ergebnisseite – `null`, wenn dem Nutzer die Permission
   * für diesen Bereich fehlt (derselbe Gate wie in `search()`). */
  async searchPaged(
    type: SearchResultType,
    q: string,
    page: number,
    pageSize: number,
    permissions: string[],
  ): Promise<PagedSearchResult | null> {
    if (!this.canSearch(type, permissions)) return null;
    const skip = (page - 1) * pageSize;

    switch (type) {
      case 'content': {
        const [items, total] = await Promise.all([
          this.searchContent(q, pageSize, skip),
          this.contentService.searchCount(q),
        ]);
        return { items, total };
      }
      case 'previewLink': {
        const where = {
          expiresAt: { gt: new Date() },
          content: { title: { contains: q, mode: 'insensitive' as const } },
        };
        const [items, total] = await Promise.all([
          this.searchPreviewLinks(q, pageSize, skip),
          this.prisma.contentPreviewToken.count({ where }),
        ]);
        return { items, total };
      }
      case 'faq':
      case 'gallery':
        return this.searchGlobalModulesPaged(type, q, pageSize, skip);
      case 'category': {
        const where = {
          OR: [
            { name: { contains: q, mode: 'insensitive' as const } },
            { description: { contains: q, mode: 'insensitive' as const } },
          ],
        };
        const [items, total] = await Promise.all([
          this.searchCategories(q, pageSize, skip),
          this.prisma.category.count({ where }),
        ]);
        return { items, total };
      }
      case 'tag': {
        const where = { name: { contains: q, mode: 'insensitive' as const } };
        const [items, total] = await Promise.all([
          this.searchTags(q, pageSize, skip),
          this.prisma.tag.count({ where }),
        ]);
        return { items, total };
      }
      case 'media': {
        const where = {
          OR: [
            { filename: { contains: q, mode: 'insensitive' as const } },
            { alt: { contains: q, mode: 'insensitive' as const } },
          ],
        };
        const [items, total] = await Promise.all([
          this.searchMedia(q, pageSize, skip),
          this.prisma.media.count({ where }),
        ]);
        return { items, total };
      }
      case 'user': {
        const where = {
          OR: [
            { firstName: { contains: q, mode: 'insensitive' as const } },
            { lastName: { contains: q, mode: 'insensitive' as const } },
            { email: { contains: q, mode: 'insensitive' as const } },
          ],
        };
        const [items, total] = await Promise.all([
          this.searchUsers(q, pageSize, skip),
          this.prisma.user.count({ where }),
        ]);
        return { items, total };
      }
      case 'role': {
        const where = {
          OR: [
            { name: { contains: q, mode: 'insensitive' as const } },
            { description: { contains: q, mode: 'insensitive' as const } },
          ],
        };
        const [items, total] = await Promise.all([
          this.searchRoles(q, pageSize, skip),
          this.prisma.role.count({ where }),
        ]);
        return { items, total };
      }
    }
  }

  private canSearch(type: SearchResultType, permissions: string[]): boolean {
    switch (type) {
      case 'content':
      case 'previewLink':
      case 'faq':
      case 'gallery':
        return permissions.includes('content:read');
      case 'category':
        return permissions.includes('categories:read');
      case 'tag':
        return permissions.includes('tags:read');
      case 'media':
        return permissions.includes('media:read');
      case 'user':
        return permissions.includes('users:read');
      case 'role':
        return permissions.includes('roles:read');
    }
  }

  private async searchContent(
    q: string,
    take: number,
    skip: number = 0,
  ): Promise<SearchResult[]> {
    const rows = await this.contentService.search(q, take, skip);
    return rows.map((row) => ({
      type: 'content' as const,
      id: row.id,
      title: row.title,
      subtitle: row.contentTypeName,
      status: row.status,
    }));
  }

  /**
   * Sucht über den Titel des verknüpften Inhalts, nicht über den Token
   * selbst (der ist ein zufälliger Hex-String, für Volltextsuche
   * bedeutungslos) – gegated auf `content:read` wie das Anlegen/
   * Auflisten der Links selbst.
   */
  private async searchPreviewLinks(
    q: string,
    take: number,
    skip: number = 0,
  ): Promise<SearchResult[]> {
    const rows = await this.prisma.contentPreviewToken.findMany({
      where: {
        expiresAt: { gt: new Date() },
        content: { title: { contains: q, mode: 'insensitive' } },
      },
      take,
      skip,
      orderBy: { createdAt: 'desc' },
      include: { content: { select: { title: true } } },
    });
    return rows.map((row) => ({
      type: 'previewLink' as const,
      id: row.id,
      title: row.content.title,
      subtitle: `Läuft ab ${row.expiresAt.toLocaleDateString('de-DE')}`,
    }));
  }

  /**
   * FAQ und Galerie sind beides `GlobalModule`-Instanzen, unterscheidbar
   * nur über die Form ihres `ModuleType.schema` (Repeater-Feld mit bzw.
   * ohne Bild-Unterfeld) statt über eine feste `moduleTypeId` oder einen
   * eigenen DB-Typ – dieselbe Form-Erkennung wie im Frontend
   * (`isFaqModuleType`/`isGalleryModuleType` in block-field-output.tsx),
   * hier serverseitig dupliziert, da beide Seiten kein gemeinsames Paket
   * teilen. Gegated auf `content:read` wie Content selbst, da FAQ/Galerie
   * unter "Inhalte" > "Seiten" liegen und dort nicht gesondert
   * eingeschränkt sind.
   */
  private async resolveGlobalModuleTypeIds() {
    const moduleTypes = await this.prisma.moduleType.findMany({
      select: { id: true, schema: true },
    });
    const faqTypeIds: string[] = [];
    const galleryTypeIds: string[] = [];
    for (const moduleType of moduleTypes) {
      const schema = moduleType.schema as {
        fields?: { type?: string; fields?: { type?: string }[] }[];
      };
      const repeaterField = (schema?.fields ?? []).find(
        (f) => f.type === 'repeater',
      );
      if (!repeaterField) continue;
      const hasImageSubField = (repeaterField.fields ?? []).some(
        (f) => f.type === 'image',
      );
      (hasImageSubField ? galleryTypeIds : faqTypeIds).push(moduleType.id);
    }
    return { faqTypeIds, galleryTypeIds };
  }

  private async searchGlobalModules(
    q: string,
    take: number,
  ): Promise<SearchResult[]> {
    const { faqTypeIds, galleryTypeIds } =
      await this.resolveGlobalModuleTypeIds();
    const typeIds = [...faqTypeIds, ...galleryTypeIds];
    if (typeIds.length === 0) return [];

    const rows = await this.prisma.globalModule.findMany({
      where: {
        moduleTypeId: { in: typeIds },
        name: { contains: q, mode: 'insensitive' },
      },
      take,
      orderBy: { name: 'asc' },
    });
    return rows.map((row): SearchResult => ({
      type: galleryTypeIds.includes(row.moduleTypeId) ? 'gallery' : 'faq',
      id: row.id,
      title: row.name,
    }));
  }

  private async searchGlobalModulesPaged(
    type: 'faq' | 'gallery',
    q: string,
    take: number,
    skip: number,
  ): Promise<PagedSearchResult> {
    const { faqTypeIds, galleryTypeIds } =
      await this.resolveGlobalModuleTypeIds();
    const typeIds = type === 'gallery' ? galleryTypeIds : faqTypeIds;
    if (typeIds.length === 0) return { items: [], total: 0 };

    const where = {
      moduleTypeId: { in: typeIds },
      name: { contains: q, mode: 'insensitive' as const },
    };
    const [rows, total] = await Promise.all([
      this.prisma.globalModule.findMany({
        where,
        take,
        skip,
        orderBy: { name: 'asc' },
      }),
      this.prisma.globalModule.count({ where }),
    ]);
    return {
      items: rows.map((row) => ({ type, id: row.id, title: row.name })),
      total,
    };
  }

  private async searchCategories(
    q: string,
    take: number,
    skip: number = 0,
  ): Promise<SearchResult[]> {
    const rows = await this.prisma.category.findMany({
      where: {
        OR: [
          { name: { contains: q, mode: 'insensitive' } },
          { description: { contains: q, mode: 'insensitive' } },
        ],
      },
      take,
      skip,
      orderBy: { name: 'asc' },
    });
    return rows.map((row) => ({
      type: 'category' as const,
      id: row.id,
      title: row.name,
      subtitle: row.description ?? undefined,
    }));
  }

  private async searchTags(
    q: string,
    take: number,
    skip: number = 0,
  ): Promise<SearchResult[]> {
    const rows = await this.prisma.tag.findMany({
      where: { name: { contains: q, mode: 'insensitive' } },
      take,
      skip,
      orderBy: { name: 'asc' },
    });
    return rows.map((row) => ({
      type: 'tag' as const,
      id: row.id,
      title: row.name,
    }));
  }

  private async searchMedia(
    q: string,
    take: number,
    skip: number = 0,
  ): Promise<SearchResult[]> {
    const rows = await this.prisma.media.findMany({
      where: {
        OR: [
          { filename: { contains: q, mode: 'insensitive' } },
          { alt: { contains: q, mode: 'insensitive' } },
        ],
      },
      take,
      skip,
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((row) => ({
      type: 'media' as const,
      id: row.id,
      title: row.filename,
      subtitle: row.alt ?? undefined,
    }));
  }

  private async searchUsers(
    q: string,
    take: number,
    skip: number = 0,
  ): Promise<SearchResult[]> {
    const rows = await this.prisma.user.findMany({
      where: {
        OR: [
          { firstName: { contains: q, mode: 'insensitive' } },
          { lastName: { contains: q, mode: 'insensitive' } },
          { email: { contains: q, mode: 'insensitive' } },
        ],
      },
      take,
      skip,
      orderBy: { lastName: 'asc' },
      include: { userRoles: { include: { role: { select: { name: true } } } } },
    });
    return rows.map((row) => ({
      type: 'user' as const,
      id: row.id,
      title: [row.firstName, row.lastName].filter(Boolean).join(' '),
      subtitle: row.userRoles.map((ur) => ur.role.name).join(', '),
    }));
  }

  private async searchRoles(
    q: string,
    take: number,
    skip: number = 0,
  ): Promise<SearchResult[]> {
    const rows = await this.prisma.role.findMany({
      where: {
        OR: [
          { name: { contains: q, mode: 'insensitive' } },
          { description: { contains: q, mode: 'insensitive' } },
        ],
      },
      take,
      skip,
      orderBy: { name: 'asc' },
    });
    return rows.map((row) => ({
      type: 'role' as const,
      id: row.id,
      title: row.name,
      subtitle: row.description ?? undefined,
    }));
  }
}
