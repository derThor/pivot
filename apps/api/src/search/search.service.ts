import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ContentService } from '../content/content.service';

export type SearchResultType =
  | 'content'
  | 'category'
  | 'tag'
  | 'media'
  | 'user'
  | 'role';

export interface SearchResult {
  type: SearchResultType;
  id: string;
  title: string;
  subtitle?: string;
  status?: string;
}

/**
 * Bündelt die Volltextsuche (`ContentService.search`) mit einfachen
 * `contains`-Suchen über Kategorien, Tags, Medien, Benutzer und Rollen
 * zu einem einheitlichen Ergebnis-Format, das im Frontend pro Treffer
 * den Bereich (`type`) flaggt. Kategorien/Tags/Medien/Benutzer/Rollen
 * nutzen bewusst kein Postgres-`tsvector` wie der Content-Body – ihre
 * Textfelder sind kurz (Name/Dateiname/E-Mail/Alt-Text), ein einfacher
 * case-insensitiver `contains`-Filter reicht dafür völlig aus.
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
    if (permissions.includes('users:manage')) {
      tasks.push(this.searchUsers(q, limit));
    }
    if (permissions.includes('roles:manage')) {
      tasks.push(this.searchRoles(q, limit));
    }

    const results = await Promise.all(tasks);
    return results.flat();
  }

  private async searchContent(q: string, limit: number): Promise<SearchResult[]> {
    const rows = await this.contentService.search(q, limit);
    return rows.map((row) => ({
      type: 'content' as const,
      id: row.id,
      title: row.title,
      subtitle: row.contentTypeName,
      status: row.status,
    }));
  }

  private async searchCategories(q: string, limit: number): Promise<SearchResult[]> {
    const rows = await this.prisma.category.findMany({
      where: {
        OR: [
          { name: { contains: q, mode: 'insensitive' } },
          { description: { contains: q, mode: 'insensitive' } },
        ],
      },
      take: limit,
      orderBy: { name: 'asc' },
    });
    return rows.map((row) => ({
      type: 'category' as const,
      id: row.id,
      title: row.name,
      subtitle: row.description ?? undefined,
    }));
  }

  private async searchTags(q: string, limit: number): Promise<SearchResult[]> {
    const rows = await this.prisma.tag.findMany({
      where: { name: { contains: q, mode: 'insensitive' } },
      take: limit,
      orderBy: { name: 'asc' },
    });
    return rows.map((row) => ({
      type: 'tag' as const,
      id: row.id,
      title: row.name,
    }));
  }

  private async searchMedia(q: string, limit: number): Promise<SearchResult[]> {
    const rows = await this.prisma.media.findMany({
      where: {
        OR: [
          { filename: { contains: q, mode: 'insensitive' } },
          { alt: { contains: q, mode: 'insensitive' } },
        ],
      },
      take: limit,
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((row) => ({
      type: 'media' as const,
      id: row.id,
      title: row.filename,
      subtitle: row.alt ?? undefined,
    }));
  }

  private async searchUsers(q: string, limit: number): Promise<SearchResult[]> {
    const rows = await this.prisma.user.findMany({
      where: {
        OR: [
          { firstName: { contains: q, mode: 'insensitive' } },
          { lastName: { contains: q, mode: 'insensitive' } },
          { email: { contains: q, mode: 'insensitive' } },
        ],
      },
      take: limit,
      orderBy: { lastName: 'asc' },
      include: { role: { select: { name: true } } },
    });
    return rows.map((row) => ({
      type: 'user' as const,
      id: row.id,
      title: [row.firstName, row.lastName].filter(Boolean).join(' '),
      subtitle: row.role.name,
    }));
  }

  private async searchRoles(q: string, limit: number): Promise<SearchResult[]> {
    const rows = await this.prisma.role.findMany({
      where: {
        OR: [
          { name: { contains: q, mode: 'insensitive' } },
          { description: { contains: q, mode: 'insensitive' } },
        ],
      },
      take: limit,
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
