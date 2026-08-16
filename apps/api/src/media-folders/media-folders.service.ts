import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MediaService } from '../media/media.service';
import { CreateMediaFolderDto } from './dto/create-media-folder.dto';
import { UpdateMediaFolderDto } from './dto/update-media-folder.dto';

@Injectable()
export class MediaFoldersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mediaService: MediaService,
  ) {}

  async findAll() {
    const folders = await this.prisma.mediaFolder.findMany({
      orderBy: { name: 'asc' },
      include: { _count: { select: { media: true, children: true } } },
    });
    return folders.map((folder) => ({
      id: folder.id,
      name: folder.name,
      parentId: folder.parentId,
      isSystem: folder.isSystem,
      mediaCount: folder._count.media,
      childCount: folder._count.children,
    }));
  }

  async create(dto: CreateMediaFolderDto) {
    if (dto.parentId) {
      await this.findOneOrThrow(dto.parentId);
    }
    await this.assertNameAvailable(dto.name, dto.parentId ?? null);
    return this.prisma.mediaFolder.create({
      data: { name: dto.name, parentId: dto.parentId },
    });
  }

  async update(id: string, dto: UpdateMediaFolderDto) {
    const current = await this.findOneOrThrow(id);

    const isMoving = dto.parentId !== undefined;
    const nextParentId = isMoving ? dto.parentId || null : current.parentId;

    if (isMoving && nextParentId) {
      await this.findOneOrThrow(nextParentId);
      await this.assertNoCycle(id, nextParentId);
    }

    if (dto.name || isMoving) {
      await this.assertNameAvailable(
        dto.name ?? current.name,
        nextParentId,
        id,
      );
    }

    return this.prisma.mediaFolder.update({
      where: { id },
      data: {
        ...(dto.name && { name: dto.name }),
        ...(isMoving && { parentId: nextParentId }),
      },
    });
  }

  async remove(id: string) {
    const folder = await this.findOneOrThrow(id);
    if (folder.isSystem) {
      throw new BadRequestException(
        'Systemordner können nicht gelöscht werden.',
      );
    }
    await this.removeRecursive(id);
  }

  /**
   * Löscht einen Ordner kaskadierend: erst alle Unterordner (rekursiv),
   * dann die Medien direkt im Ordner über `MediaService.remove()` (löscht
   * dieselbe Weise die Datei von Disk wie beim Einzel-Löschen), zuletzt
   * den Ordner selbst. Die Warnung vor dem unwiderruflichen Löschen von
   * Inhalten erfolgt im Frontend vor dem Aufruf.
   */
  private async removeRecursive(folderId: string) {
    const children = await this.prisma.mediaFolder.findMany({
      where: { parentId: folderId },
      select: { id: true },
    });
    for (const child of children) {
      await this.removeRecursive(child.id);
    }

    const media = await this.prisma.media.findMany({
      where: { folderId },
      select: { id: true },
    });
    for (const item of media) {
      await this.mediaService.remove(item.id);
    }

    await this.prisma.mediaFolder.delete({ where: { id: folderId } });
  }

  private async findOneOrThrow(id: string) {
    const folder = await this.prisma.mediaFolder.findUnique({ where: { id } });
    if (!folder) {
      throw new NotFoundException(`Ordner ${id} nicht gefunden.`);
    }
    return folder;
  }

  private async assertNameAvailable(
    name: string,
    parentId: string | null,
    excludeId?: string,
  ) {
    const existing = await this.prisma.mediaFolder.findFirst({
      where: {
        name,
        parentId,
        ...(excludeId && { id: { not: excludeId } }),
      },
    });
    if (existing) {
      throw new ConflictException(
        'Ein Ordner mit diesem Namen existiert bereits in diesem Elternordner.',
      );
    }
  }

  /** Verhindert, dass ein Ordner in sich selbst oder einen eigenen Nachfahren verschoben wird. */
  private async assertNoCycle(folderId: string, newParentId: string) {
    let currentId: string | null = newParentId;
    while (currentId) {
      if (currentId === folderId) {
        throw new BadRequestException(
          'Ein Ordner kann nicht in sich selbst oder einen eigenen Unterordner verschoben werden.',
        );
      }
      const current: { parentId: string | null } | null =
        await this.prisma.mediaFolder.findUnique({
          where: { id: currentId },
          select: { parentId: true },
        });
      currentId = current?.parentId ?? null;
    }
  }
}
