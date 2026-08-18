import {
  BadRequestException,
  forwardRef,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { copyFile, readFile, unlink, writeFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { SettingsService } from '../settings/settings.service';
import { CropMediaDto } from './dto/crop-media.dto';
import { QueryMediaDto } from './dto/query-media.dto';
import { UpdateMediaDto } from './dto/update-media.dto';
import {
  UPLOAD_DIR,
  maxSizeForMimeType,
  mimeTypesForCategory,
} from './media.config';
import { Prisma } from '@pivot/database';
import {
  MediaImageProcessingService,
  type FocalPoint,
} from './media-image-processing.service';

type VariantInput = {
  width: number;
  format: string;
  url: string;
  size: number;
};

const TAGS_INCLUDE = {
  tags: { include: { tag: { select: { id: true, name: true, slug: true } } } },
} satisfies Prisma.MediaInclude;

function mapMediaTags<
  T extends { tags: { tag: { id: string; name: string; slug: string } }[] },
>(
  media: T,
): Omit<T, 'tags'> & { tags: { id: string; name: string; slug: string }[] } {
  return { ...media, tags: media.tags.map((t) => t.tag) };
}

// Medien werden ausschließlich per (loser) URL innerhalb von JSON-/HTML-
// Feldern referenziert, nicht per Fremdschlüssel – Content-Module
// speichern relative Pfade (z.B. "/uploads/xyz.jpg"), Rich-Text-HTML
// (<img src>/<a href>) dagegen absolute URLs (siehe mediaUrl() im
// Frontend). Für den Abgleich beide Seiten auf den reinen Pfad normalisieren.
function normalizeUrl(url: string): string {
  return url.replace(/^https?:\/\/[^/]+/, '');
}

function collectReferencedUrls(
  value: Prisma.JsonValue | undefined,
  urls: Set<string>,
): void {
  if (typeof value === 'string') {
    urls.add(normalizeUrl(value));
    for (const match of value.matchAll(/(?:src|href)=["']([^"']+)["']/g)) {
      urls.add(normalizeUrl(match[1]));
    }
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectReferencedUrls(item, urls);
    return;
  }
  if (value && typeof value === 'object') {
    for (const item of Object.values(value)) collectReferencedUrls(item, urls);
  }
}

@Injectable()
export class MediaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly imageProcessing: MediaImageProcessingService,
    private readonly auditLog: AuditLogService,
    @Inject(forwardRef(() => SettingsService))
    private readonly settings: SettingsService,
  ) {}

  async findAll(query: QueryMediaDto) {
    const { page, pageSize, folderId, type, minSize, maxSize, tagIds } = query;
    const where: Prisma.MediaWhereInput = {
      ...(folderId === 'root' && { folderId: null }),
      ...(folderId && folderId !== 'root' && { folderId }),
      ...(type && {
        mimeType: {
          in:
            type === 'document'
              ? [
                  ...mimeTypesForCategory('pdf'),
                  ...mimeTypesForCategory('office'),
                ]
              : mimeTypesForCategory(type),
        },
      }),
      ...((minSize !== undefined || maxSize !== undefined) && {
        size: {
          ...(minSize !== undefined && { gte: minSize }),
          ...(maxSize !== undefined && { lte: maxSize }),
        },
      }),
      ...(tagIds &&
        tagIds.length > 0 && {
          tags: { some: { tagId: { in: tagIds } } },
        }),
      deletedAt: null,
    };

    const [items, total] = await Promise.all([
      this.prisma.media.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: {
          uploadedBy: { select: { id: true, firstName: true, lastName: true } },
          variants: true,
          ...TAGS_INCLUDE,
        },
      }),
      this.prisma.media.count({ where }),
    ]);

    return {
      items: items.map(mapMediaTags),
      meta: { page, pageSize, total, pageCount: Math.ceil(total / pageSize) },
    };
  }

  /**
   * Zähler für die Dateityp-Pillen im Medien-Filter (Nutzervorgabe,
   * 2026-08-15, 1:1 nach Bildvorlage) – bewusst nur nach `folderId`
   * gescoped, nicht zusätzlich nach Tag/Größe gefiltert: die Pillen
   * sollen zeigen, was im aktuellen Ordner insgesamt an Dateitypen
   * vorhanden ist, unabhängig von den übrigen, gerade aktiven Filtern.
   * "pdf" und "office" werden zu einer gemeinsamen "document"-Zahl
   * zusammengefasst (Nutzerentscheidung: nur echte, hochladbare
   * Kategorien zeigen – kein separates "Audio"/"Archive" ohne
   * Upload-Unterstützung).
   */
  async getCounts(folderId?: string) {
    const scope: Prisma.MediaWhereInput = {
      deletedAt: null,
      ...(folderId === 'root' && { folderId: null }),
      ...(folderId && folderId !== 'root' && { folderId }),
    };
    const countByCategory = (category: 'image' | 'video' | 'pdf' | 'office') =>
      this.prisma.media.count({
        where: { ...scope, mimeType: { in: mimeTypesForCategory(category) } },
      });

    const [total, image, video, pdf, office] = await Promise.all([
      this.prisma.media.count({ where: scope }),
      countByCategory('image'),
      countByCategory('video'),
      countByCategory('pdf'),
      countByCategory('office'),
    ]);

    return { total, image, video, document: pdf + office };
  }

  /**
   * On-Demand-Scan statt dauerhaft gepflegtem Index: Medien werden nur
   * per loser URL referenziert (kein FK), ein Live-Index müsste jeden
   * Content-Mutationspfad anfassen – unverhältnismäßig für ein reines
   * Report-Feature. Durchsucht nur aktive `Content`-Datensätze (keine
   * `ContentVersion`-Historie) + SEO-Bild + Logo-Einstellungen. Löscht
   * nichts automatisch – markiert nur, die bestehende Mehrfachauswahl im
   * Frontend übernimmt das eigentliche Löschen.
   */
  async findUnused() {
    const [allMedia, contents, settings] = await Promise.all([
      this.prisma.media.findMany({
        where: { deletedAt: null },
        orderBy: { createdAt: 'desc' },
        include: {
          uploadedBy: { select: { id: true, firstName: true, lastName: true } },
          variants: true,
          ...TAGS_INCLUDE,
        },
      }),
      this.prisma.content.findMany({
        where: { deletedAt: null },
        select: { data: true, ogImageUrl: true },
      }),
      this.prisma.appSettings.findUnique({ where: { id: 1 } }),
    ]);

    const referenced = new Set<string>();
    for (const content of contents) {
      collectReferencedUrls(content.data, referenced);
      if (content.ogImageUrl) referenced.add(normalizeUrl(content.ogImageUrl));
    }
    if (settings?.companyLogoUrl)
      referenced.add(normalizeUrl(settings.companyLogoUrl));

    const unused = allMedia.filter(
      (media) => !referenced.has(normalizeUrl(media.url)),
    );
    return { items: unused.map(mapMediaTags) };
  }

  /**
   * Belegter Speicher = Summe der Originaldateien + aller generierten
   * Varianten (Thumbnails/responsive Formate), da diese ebenfalls
   * physisch auf der Platte liegen. Kontingent kommt aus den
   * AppSettings (MB, `null` = unbegrenzt).
   */
  async getStorageUsage() {
    const [mediaSize, variantSize, settings] = await Promise.all([
      this.prisma.media.aggregate({ _sum: { size: true } }),
      this.prisma.mediaVariant.aggregate({ _sum: { size: true } }),
      this.prisma.appSettings.findUnique({ where: { id: 1 } }),
    ]);
    const usedBytes = (mediaSize._sum.size ?? 0) + (variantSize._sum.size ?? 0);
    const quotaMb = settings?.mediaStorageQuotaMb ?? null;
    const quotaBytes = quotaMb != null ? quotaMb * 1024 * 1024 : null;
    const percentUsed = quotaBytes
      ? Math.min(100, (usedBytes / quotaBytes) * 100)
      : null;
    return { usedBytes, quotaMb, percentUsed };
  }

  /**
   * Zählt, in wie vielen Inhalten dieses Medium referenziert wird – für
   * das "Verwendet"-Feld in der Medien-Detailansicht (Nutzervorgabe,
   * 2026-08-17). Derselbe On-Demand-Scan wie `findUnused` (kein
   * dauerhaft gepflegter Index, siehe dortiger Kommentar), hier nur auf
   * ein einzelnes Medium statt die ganze Bibliothek angewendet.
   */
  async getUsage(id: string) {
    const media = await this.prisma.media.findUniqueOrThrow({ where: { id } });
    const targetUrl = normalizeUrl(media.url);
    const contents = await this.prisma.content.findMany({
      where: { deletedAt: null },
      select: { data: true, ogImageUrl: true },
    });
    let count = 0;
    for (const content of contents) {
      const urls = new Set<string>();
      collectReferencedUrls(content.data, urls);
      if (content.ogImageUrl) urls.add(normalizeUrl(content.ogImageUrl));
      if (urls.has(targetUrl)) count++;
    }
    return { count };
  }

  /**
   * Ermittelt, auf welcher Seite (bei gegebener pageSize) ein Eintrag
   * liegt – innerhalb des Ordners, in dem er tatsächlich liegt (die
   * Medien-Übersicht ist ordnerbezogen gefiltert, ein Eintrag aus einem
   * Unterordner taucht auf der Root-Seite nie auf). Liefert `folderId`
   * mit zurück, damit das Frontend zusätzlich zur Seite auch in den
   * richtigen Ordner wechseln kann.
   */
  async findPage(id: string, pageSize: number) {
    const target = await this.prisma.media.findUniqueOrThrow({
      where: { id },
    });
    const rank = await this.prisma.media.count({
      where: {
        folderId: target.folderId,
        createdAt: { gt: target.createdAt },
      },
    });
    return {
      page: Math.floor(rank / pageSize) + 1,
      folderId: target.folderId,
    };
  }

  async create(
    file: Express.Multer.File,
    uploadedById: string,
    alt?: string,
    folderId?: string,
  ) {
    // Effektive Obergrenze = Minimum aus technischer Kategorie-Obergrenze
    // und der optionalen Admin-Einstellung (Nutzervorgabe, 2026-08-18) –
    // die Einstellung kann nur verschärfen, nie über die Kategorie-Grenze
    // hinaus aufweichen. Gilt für jeden Upload-Weg, da Avatar/Firmenlogo
    // ebenfalls über diese Methode laufen (siehe UsersService.updateAvatar()).
    const settings = await this.settings.get();
    const maxSize = Math.min(
      maxSizeForMimeType(file.mimetype),
      settings.maxUploadSizeMb
        ? settings.maxUploadSizeMb * 1024 * 1024
        : Infinity,
    );
    if (file.size > maxSize) {
      await unlink(file.path).catch(() => {});
      throw new BadRequestException(
        `Datei ist zu groß (max. ${Math.round(maxSize / (1024 * 1024))} MB für diesen Dateityp).`,
      );
    }

    const { width, height, variants, thumbnailUrl } =
      await this.processUpload(file);

    const media = await this.prisma.media.create({
      data: {
        filename: file.originalname,
        url: `/uploads/${file.filename}`,
        mimeType: file.mimetype,
        size: file.size,
        width,
        height,
        alt,
        thumbnailUrl,
        uploadedById,
        folderId,
        variants: variants.length ? { create: variants } : undefined,
      },
      include: { variants: true, ...TAGS_INCLUDE },
    });
    await this.auditLog.record({
      action: 'media.uploaded',
      entityType: 'Media',
      entityId: media.id,
      userId: uploadedById,
      metadata: { filename: file.originalname },
    });
    return mapMediaTags(media);
  }

  /**
   * Normalisiert Raster-Bilder (Auto-Rotate, EXIF-Entfernung, Downscale-Cap
   * – ersetzt dabei die gerade hochgeladene Datei auf Disk durch die
   * normalisierte Fassung) und generiert bei aktiviertem
   * `AppSettings.mediaResponsiveVariantsEnabled` zusätzlich WebP/AVIF-
   * Größenvarianten. gif/svg und alle Nicht-Bild-Dateien bleiben
   * unverändert; bei gif wird nur die erste-Frame-Dimension ermittelt.
   */
  private async processUpload(file: Express.Multer.File) {
    let width: number | null = null;
    let height: number | null = null;
    let variants: VariantInput[] = [];
    let thumbnailUrl: string | null = null;

    if (this.imageProcessing.isProcessable(file.mimetype)) {
      const originalBuffer = await readFile(file.path);
      let normalized: Buffer;
      try {
        normalized = await this.imageProcessing.normalize(originalBuffer);
      } catch {
        await unlink(file.path).catch(() => {});
        throw new BadRequestException(
          'Datei ist beschädigt oder kein gültiges Bild.',
        );
      }
      await writeFile(file.path, normalized);
      file.size = normalized.length;

      const dimensions = await this.imageProcessing.getDimensions(normalized);
      width = dimensions.width;
      height = dimensions.height;

      if (width && height) {
        variants = await this.generateVariantsIfEnabled(normalized, width);
        thumbnailUrl = await this.generateThumbnailIfEnabled(
          normalized,
          width,
          height,
        );
      }
    } else if (file.mimetype === 'image/gif') {
      const buffer = await readFile(file.path);
      const dimensions = await this.imageProcessing.getDimensions(buffer);
      width = dimensions.width;
      height = dimensions.height;

      if (width && height) {
        thumbnailUrl = await this.generateThumbnailIfEnabled(
          buffer,
          width,
          height,
        );
      }
    }

    return { width, height, variants, thumbnailUrl };
  }

  /**
   * Generiert WebP/AVIF-Varianten und schreibt sie auf Disk, sofern
   * `AppSettings.mediaResponsiveVariantsEnabled` aktiv ist. Von Upload
   * (`processUpload`) und Zuschneiden (`crop`) gemeinsam genutzt.
   */
  private async generateVariantsIfEnabled(
    buffer: Buffer,
    sourceWidth: number,
  ): Promise<VariantInput[]> {
    const settings = await this.prisma.appSettings.findUnique({
      where: { id: 1 },
    });
    if (!(settings?.mediaResponsiveVariantsEnabled ?? true)) {
      return [];
    }

    const generated = await this.imageProcessing.generateVariants(
      buffer,
      sourceWidth,
    );
    const variants: VariantInput[] = [];
    for (const variant of generated) {
      const variantFilename = `${randomUUID()}.${variant.format}`;
      await writeFile(join(UPLOAD_DIR, variantFilename), variant.buffer);
      variants.push({
        width: variant.width,
        format: variant.format,
        url: `/uploads/${variantFilename}`,
        size: variant.size,
      });
    }
    return variants;
  }

  /**
   * Generiert das quadratische Thumbnail (Zuschnitt-Anker: Fokuspunkt,
   * Default Bildmitte) und schreibt es auf Disk, sofern
   * `AppSettings.mediaResponsiveVariantsEnabled` aktiv ist (gleicher
   * Schalter wie bei den Responsive-Varianten – kein zweiter nur dafür).
   */
  private async generateThumbnailIfEnabled(
    buffer: Buffer,
    width: number,
    height: number,
    focal?: FocalPoint,
  ): Promise<string | null> {
    const settings = await this.prisma.appSettings.findUnique({
      where: { id: 1 },
    });
    if (!(settings?.mediaResponsiveVariantsEnabled ?? true)) {
      return null;
    }

    const thumbnail = await this.imageProcessing.generateSquareThumbnail(
      buffer,
      width,
      height,
      focal,
    );
    const filename = `${randomUUID()}.png`;
    await writeFile(join(UPLOAD_DIR, filename), thumbnail);
    return `/uploads/${filename}`;
  }

  /**
   * Erzeugt aus einem Zuschnitt ein NEUES, eigenständiges Medium (statt
   * das Original zu überschreiben) – Original bleibt in allen
   * bestehenden Verwendungen (Content, SEO-Bild, Logo) unverändert, siehe
   * Entscheidung in knowledge-base/media/. Das Original wird dabei nicht
   * verändert, nur als Quelle gelesen.
   */
  async crop(id: string, rect: CropMediaDto, userId: string) {
    const source = await this.findOneOrThrow(id);

    if (!this.imageProcessing.isProcessable(source.mimeType)) {
      throw new BadRequestException(
        'Dieser Dateityp kann nicht zugeschnitten werden.',
      );
    }
    if (!source.width || !source.height) {
      throw new BadRequestException(
        'Für dieses Medium sind keine Bilddimensionen bekannt.',
      );
    }
    if (
      rect.x + rect.width > source.width ||
      rect.y + rect.height > source.height
    ) {
      throw new BadRequestException(
        'Der Zuschnitt liegt außerhalb der Bildgrenzen.',
      );
    }

    const sourceBuffer = await readFile(
      join(UPLOAD_DIR, source.url.replace(/^\/uploads\//, '')),
    );
    const cropped = await this.imageProcessing.crop(sourceBuffer, rect);

    const ext = extname(source.filename) || '.jpg';
    const baseName = source.filename.slice(
      0,
      source.filename.length - ext.length,
    );
    const croppedFilename = `${randomUUID()}${ext}`;
    await writeFile(join(UPLOAD_DIR, croppedFilename), cropped);

    const variants = await this.generateVariantsIfEnabled(cropped, rect.width);
    const thumbnailUrl = await this.generateThumbnailIfEnabled(
      cropped,
      rect.width,
      rect.height,
    );

    const media = await this.prisma.media.create({
      data: {
        filename: `${baseName} (Zuschnitt)${ext}`,
        url: `/uploads/${croppedFilename}`,
        mimeType: source.mimeType,
        size: cropped.length,
        width: rect.width,
        height: rect.height,
        alt: source.alt,
        thumbnailUrl,
        uploadedById: userId,
        folderId: source.folderId,
        variants: variants.length ? { create: variants } : undefined,
      },
      include: { variants: true, ...TAGS_INCLUDE },
    });
    return mapMediaTags(media);
  }

  /**
   * Kopiert die physische Datei (nicht nur die URL) – Original und Kopie
   * haben dadurch unabhängige Lebenszyklen (Löschen/Bearbeiten der einen
   * Kopie berührt die andere nicht), was bei geteilten Dateien nicht der
   * Fall wäre (`remove()` löscht die Datei von Disk). Varianten werden
   * für die Kopie neu generiert statt kopiert – einfacher als
   * Datei-Umbenennungs-Bookkeeping für jede Variante.
   */
  async duplicate(id: string, userId: string) {
    const source = await this.prisma.media.findUnique({
      where: { id },
      include: TAGS_INCLUDE,
    });
    if (!source) {
      throw new NotFoundException(`Medium ${id} nicht gefunden.`);
    }

    const sourceFilename = source.url.replace(/^\/uploads\//, '');
    const ext = extname(sourceFilename);
    const newFilename = `${randomUUID()}${ext}`;
    await copyFile(
      join(UPLOAD_DIR, sourceFilename),
      join(UPLOAD_DIR, newFilename),
    );

    let variants: VariantInput[] = [];
    let thumbnailUrl: string | null = null;
    if (
      this.imageProcessing.isThumbnailable(source.mimeType) &&
      source.width &&
      source.height
    ) {
      const buffer = await readFile(join(UPLOAD_DIR, newFilename));
      if (this.imageProcessing.isProcessable(source.mimeType)) {
        variants = await this.generateVariantsIfEnabled(buffer, source.width);
      }
      thumbnailUrl = await this.generateThumbnailIfEnabled(
        buffer,
        source.width,
        source.height,
        source.focalX != null && source.focalY != null
          ? { x: source.focalX, y: source.focalY }
          : undefined,
      );
    }

    const filenameExt = extname(source.filename);
    const baseName = filenameExt
      ? source.filename.slice(0, source.filename.length - filenameExt.length)
      : source.filename;

    const media = await this.prisma.media.create({
      data: {
        filename: `${baseName} (Kopie)${filenameExt}`,
        url: `/uploads/${newFilename}`,
        mimeType: source.mimeType,
        size: source.size,
        width: source.width,
        height: source.height,
        alt: source.alt,
        focalX: source.focalX,
        focalY: source.focalY,
        thumbnailUrl,
        uploadedById: userId,
        folderId: source.folderId,
        variants: variants.length ? { create: variants } : undefined,
        tags: source.tags.length
          ? { create: source.tags.map((t) => ({ tagId: t.tagId })) }
          : undefined,
      },
      include: { variants: true, ...TAGS_INCLUDE },
    });
    return mapMediaTags(media);
  }

  async update(id: string, dto: UpdateMediaDto) {
    const existing = await this.findOneOrThrow(id);
    const { tagIds, ...rest } = dto;

    // Fokuspunkt geändert → Thumbnail mit dem neuen Anker neu erzeugen.
    let thumbnailUrl: string | null | undefined;
    if (
      (dto.focalX !== undefined || dto.focalY !== undefined) &&
      this.imageProcessing.isThumbnailable(existing.mimeType) &&
      existing.width &&
      existing.height
    ) {
      const focal: FocalPoint = {
        x: dto.focalX ?? existing.focalX ?? 0.5,
        y: dto.focalY ?? existing.focalY ?? 0.5,
      };
      const buffer = await readFile(
        join(UPLOAD_DIR, existing.url.replace(/^\/uploads\//, '')),
      );
      if (existing.thumbnailUrl) {
        await unlink(
          join(UPLOAD_DIR, existing.thumbnailUrl.replace(/^\/uploads\//, '')),
        ).catch(() => {});
      }
      thumbnailUrl = await this.generateThumbnailIfEnabled(
        buffer,
        existing.width,
        existing.height,
        focal,
      );
    }

    const media = await this.prisma.media.update({
      where: { id },
      data: {
        ...rest,
        ...(thumbnailUrl !== undefined && { thumbnailUrl }),
        ...(tagIds && {
          tags: {
            deleteMany: {},
            create: tagIds.map((tagId) => ({ tagId })),
          },
        }),
      },
      include: { variants: true, ...TAGS_INCLUDE },
    });
    return mapMediaTags(media);
  }

  /** Papierkorb: Soft-Delete – die physische Datei bleibt liegen, damit
   * `restore()` sie zurückgeben kann. Erst `permanentDelete()` löscht die
   * Datei wirklich von Disk (Nutzervorgabe, 2026-08-18, "überall da wo man
   * löschen kann"). */
  async remove(id: string, actingUserId: string) {
    const media = await this.prisma.media.findUnique({ where: { id } });
    if (!media) {
      throw new NotFoundException(`Medium ${id} nicht gefunden.`);
    }
    await this.prisma.media.update({
      where: { id },
      data: { deletedAt: new Date(), deletedById: actingUserId },
    });
  }

  async restore(id: string) {
    const media = await this.prisma.media.findUnique({ where: { id } });
    if (!media || !media.deletedAt) {
      throw new NotFoundException(
        `Medium ${id} befindet sich nicht im Papierkorb.`,
      );
    }
    return this.prisma.media.update({
      where: { id },
      data: { deletedAt: null, deletedById: null },
    });
  }

  async permanentDelete(id: string) {
    const media = await this.prisma.media.findUnique({
      where: { id },
      include: { variants: true },
    });
    if (!media || !media.deletedAt) {
      throw new NotFoundException(
        `Medium ${id} befindet sich nicht im Papierkorb.`,
      );
    }

    await this.prisma.media.delete({ where: { id } });

    const urls = [
      media.url,
      ...media.variants.map((variant) => variant.url),
      ...(media.thumbnailUrl ? [media.thumbnailUrl] : []),
    ];
    await Promise.all(
      urls.map((url) =>
        unlink(join(UPLOAD_DIR, url.replace(/^\/uploads\//, ''))).catch(() => {
          // Datei bereits weg (z.B. manuell gelöscht) – DB-Zeile ist trotzdem entfernt.
        }),
      ),
    );
  }

  /** Ungepaginiert für den vereinheitlichten Papierkorb (`TrashService`),
   * der alle sechs Typen zu einer gemeinsamen Liste zusammenführt. */
  findAllTrashed() {
    return this.prisma.media.findMany({
      where: { deletedAt: { not: null } },
      orderBy: { deletedAt: 'desc' },
      include: {
        deletedBy: { select: { id: true, firstName: true, lastName: true } },
        variants: { select: { size: true } },
        folder: { select: { name: true } },
      },
    });
  }

  async findTrashed(query: QueryMediaDto) {
    const { page, pageSize } = query;
    const where = { deletedAt: { not: null } };
    const [items, total] = await Promise.all([
      this.prisma.media.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { deletedAt: 'desc' },
        include: {
          uploadedBy: { select: { id: true, firstName: true, lastName: true } },
          deletedBy: { select: { id: true, firstName: true, lastName: true } },
          variants: true,
          ...TAGS_INCLUDE,
        },
      }),
      this.prisma.media.count({ where }),
    ]);
    return {
      items: items.map(mapMediaTags),
      meta: { page, pageSize, total, pageCount: Math.ceil(total / pageSize) },
    };
  }

  async findTrashedOlderThan(cutoff: Date) {
    return this.prisma.media.findMany({
      where: { deletedAt: { not: null, lt: cutoff } },
      orderBy: { deletedAt: 'asc' },
      select: { id: true, filename: true, deletedAt: true },
    });
  }

  private async findOneOrThrow(id: string) {
    const media = await this.prisma.media.findUnique({ where: { id } });
    if (!media) {
      throw new NotFoundException(`Medium ${id} nicht gefunden.`);
    }
    return media;
  }
}
