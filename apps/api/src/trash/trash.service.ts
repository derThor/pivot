import { Injectable } from '@nestjs/common';
import { SettingsService } from '../settings/settings.service';
import { ContentService } from '../content/content.service';
import { MediaService } from '../media/media.service';
import { CategoriesService } from '../categories/categories.service';
import { TagsService } from '../tags/tags.service';
import { GlobalModulesService } from '../global-modules/global-modules.service';
import type { TrashType } from './trash.types';

interface DeletedByRef {
  id: string;
  firstName: string | null;
  lastName: string;
}

export interface TrashItem {
  id: string;
  type: TrashType;
  title: string;
  subtitle: string | null;
  deletedAt: Date;
  deletedBy: DeletedByRef | null;
  sizeBytes: number | null;
}

export interface TrashItemWithExpiry extends TrashItem {
  expiresAt: Date;
  daysLeft: number;
  expired: boolean;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;
// "Verfällt in 7 Tagen"-Warnbanner, siehe Bildvorlage.
const EXPIRING_SOON_DAYS = 7;

const CONTENT_STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Entwurf',
  PUBLISHED: 'veröffentlicht',
  SCHEDULED: 'geplant',
  ARCHIVED: 'archiviert',
};

/** Heuristik statt echtem Schema-Zugriff: Galerien/FAQs (`GlobalModule`)
 * legen ihre Einträge (Bilder/Fragen) als einziges Array-Feld in `values`
 * ab (siehe `gallery-grid.tsx`/`faq-groups-manager.tsx`, die dafür das
 * Repeater-Feld aus `moduleType.schema` auflösen) – für die Papierkorb-
 * Übersicht reicht die Array-Länge, ohne extra den vollen `ModuleType`
 * mitzuladen. */
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function countRepeaterItems(values: unknown): number {
  if (!values || typeof values !== 'object') return 0;
  const arrayField = Object.values(values as Record<string, unknown>).find(
    (v) => Array.isArray(v),
  );
  return Array.isArray(arrayField) ? arrayField.length : 0;
}

@Injectable()
export class TrashService {
  constructor(
    private readonly settings: SettingsService,
    private readonly content: ContentService,
    private readonly media: MediaService,
    private readonly categories: CategoriesService,
    private readonly tags: TagsService,
    private readonly globalModules: GlobalModulesService,
  ) {}

  private serviceFor(type: TrashType) {
    switch (type) {
      case 'content':
        return this.content;
      case 'media':
        return this.media;
      case 'categories':
        return this.categories;
      case 'tags':
        return this.tags;
      case 'gallery':
      case 'faq':
        return this.globalModules;
    }
  }

  /** Sammelt alle sechs Papierkorb-Typen in eine gemeinsame Form. `types`
   * schränkt (falls gesetzt) auf die Typen ein, für die der Aufrufer
   * Lese-/Löschrechte hat – ohne diese Einschränkung würde z.B. ein Nutzer
   * mit nur `tags:read` auch fremde gelöschte Seiten/Medien sehen. */
  private async collect(types?: TrashType[]): Promise<TrashItem[]> {
    const wants = (type: TrashType) => !types || types.includes(type);
    const [content, media, categories, tags, modules] = await Promise.all([
      wants('content') ? this.content.findAllTrashed() : Promise.resolve([]),
      wants('media') ? this.media.findAllTrashed() : Promise.resolve([]),
      wants('categories')
        ? this.categories.findAllTrashed()
        : Promise.resolve([]),
      wants('tags') ? this.tags.findAllTrashed() : Promise.resolve([]),
      wants('gallery') || wants('faq')
        ? this.globalModules.findTrashed()
        : Promise.resolve([]),
    ]);

    const items: TrashItem[] = [];

    for (const c of content) {
      const statusLabel = CONTENT_STATUS_LABELS[c.status] ?? c.status;
      items.push({
        id: c.id,
        type: 'content',
        title: c.title,
        subtitle: `/${c.slug} · war ${statusLabel}`,
        deletedAt: c.deletedAt as Date,
        deletedBy: c.deletedBy,
        sizeBytes: null,
      });
    }

    for (const m of media) {
      const variantsSize = m.variants.reduce((sum, v) => sum + v.size, 0);
      const totalSize = m.size + variantsSize;
      const path = m.folder ? `/medien/${m.folder.name}` : '/medien';
      items.push({
        id: m.id,
        type: 'media',
        title: m.filename,
        subtitle: `${path} · ${formatBytes(totalSize)}`,
        deletedAt: m.deletedAt as Date,
        deletedBy: m.deletedBy,
        sizeBytes: totalSize,
      });
    }

    for (const cat of categories) {
      const uses = cat._count.contents;
      items.push({
        id: cat.id,
        type: 'categories',
        title: cat.name,
        subtitle: `– · war an ${uses} ${uses === 1 ? 'Seite' : 'Seiten'}`,
        deletedAt: cat.deletedAt as Date,
        deletedBy: cat.deletedBy,
        sizeBytes: null,
      });
    }

    for (const t of tags) {
      const uses = t._count.contents;
      items.push({
        id: t.id,
        type: 'tags',
        title: t.name,
        subtitle: `– · war an ${uses} ${uses === 1 ? 'Seite' : 'Seiten'}`,
        deletedAt: t.deletedAt as Date,
        deletedBy: t.deletedBy,
        sizeBytes: null,
      });
    }

    for (const gm of modules) {
      const type: TrashType = gm.moduleType.slug === 'faq' ? 'faq' : 'gallery';
      if (!wants(type)) continue;
      const count = countRepeaterItems(gm.values);
      const unit =
        type === 'faq'
          ? count === 1
            ? 'Frage'
            : 'Fragen'
          : count === 1
            ? 'Bild'
            : 'Bilder';
      items.push({
        id: gm.id,
        type,
        title: gm.name,
        subtitle: `${count} ${unit}`,
        deletedAt: gm.deletedAt as Date,
        deletedBy: gm.deletedBy,
        sizeBytes: null,
      });
    }

    items.sort((a, b) => b.deletedAt.getTime() - a.deletedAt.getTime());
    return items;
  }

  private async withExpiryMeta(
    items: TrashItem[],
  ): Promise<{ items: TrashItemWithExpiry[]; retentionDays: number }> {
    const settings = await this.settings.get();
    const retentionDays = settings.retentionTrashDays;
    const now = Date.now();
    return {
      retentionDays,
      items: items.map((item) => {
        const expiresAt = new Date(
          item.deletedAt.getTime() + retentionDays * MS_PER_DAY,
        );
        const daysLeft = Math.ceil((expiresAt.getTime() - now) / MS_PER_DAY);
        return { ...item, expiresAt, daysLeft, expired: daysLeft <= 0 };
      }),
    };
  }

  async list(filter: { types: TrashType[]; type?: TrashType; q?: string }) {
    const all = await this.collect(filter.types);
    const { items, retentionDays } = await this.withExpiryMeta(all);

    // Statistiken (Kacheln) beziehen sich immer auf ALLES, was der Nutzer
    // sehen darf – unabhängig von Typ-Filter/Suche in der Tabelle darunter.
    const expiringSoonCount = items.filter(
      (item) => !item.expired && item.daysLeft <= EXPIRING_SOON_DAYS,
    ).length;
    const storageBytes = items.reduce(
      (sum, item) => sum + (item.sizeBytes ?? 0),
      0,
    );
    const countsByType = items.reduce<Record<string, number>>((acc, item) => {
      acc[item.type] = (acc[item.type] ?? 0) + 1;
      return acc;
    }, {});
    const typesCount = Object.keys(countsByType).length;

    const q = filter.q?.trim().toLowerCase();
    const filtered = items.filter((item) => {
      if (filter.type && item.type !== filter.type) return false;
      if (q) {
        const haystack = `${item.title} ${item.subtitle ?? ''}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });

    return {
      items: filtered,
      stats: {
        total: items.length,
        expiringSoonCount,
        storageBytes,
        retentionDays,
        typesCount,
        countsByType,
      },
    };
  }

  async restore(type: TrashType, id: string) {
    return this.serviceFor(type).restore(id);
  }

  async permanentDelete(type: TrashType, id: string) {
    return this.serviceFor(type).permanentDelete(id);
  }

  async emptyAll(types: TrashType[]) {
    const all = await this.collect(types);
    for (const item of all) {
      await this.serviceFor(item.type).permanentDelete(item.id);
    }
    return { count: all.length };
  }

  /** Für den "Alle wiederherstellen"-Button im Warnbanner: stellt nur die
   * demnächst (aber noch nicht) ablaufenden Einträge wieder her – bereits
   * abgelaufene bleiben absichtlich gesperrt liegen (keine automatische
   * Löschung, siehe Plan). */
  async restoreExpiring(types: TrashType[]) {
    const all = await this.collect(types);
    const { items } = await this.withExpiryMeta(all);
    const expiring = items.filter(
      (item) => !item.expired && item.daysLeft <= EXPIRING_SOON_DAYS,
    );
    for (const item of expiring) {
      await this.serviceFor(item.type).restore(item.id);
    }
    return { count: expiring.length };
  }
}
