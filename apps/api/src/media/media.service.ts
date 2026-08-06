import { Injectable, NotFoundException } from '@nestjs/common';
import { unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { PrismaService } from '../prisma/prisma.service';
import { QueryMediaDto } from './dto/query-media.dto';
import { UpdateMediaDto } from './dto/update-media.dto';
import { UPLOAD_DIR } from './media.config';

@Injectable()
export class MediaService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: QueryMediaDto) {
    const { page, pageSize, folderId } = query;
    const where = {
      ...(folderId === 'root' && { folderId: null }),
      ...(folderId && folderId !== 'root' && { folderId }),
    };

    const [items, total] = await Promise.all([
      this.prisma.media.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: {
          uploadedBy: { select: { id: true, firstName: true, lastName: true } },
        },
      }),
      this.prisma.media.count({ where }),
    ]);

    return {
      items,
      meta: { page, pageSize, total, pageCount: Math.ceil(total / pageSize) },
    };
  }

  create(
    file: Express.Multer.File,
    uploadedById: string,
    alt?: string,
    folderId?: string,
  ) {
    return this.prisma.media.create({
      data: {
        filename: file.originalname,
        url: `/uploads/${file.filename}`,
        mimeType: file.mimetype,
        size: file.size,
        alt,
        uploadedById,
        folderId,
      },
    });
  }

  async update(id: string, dto: UpdateMediaDto) {
    await this.findOneOrThrow(id);
    return this.prisma.media.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    const media = await this.findOneOrThrow(id);
    await this.prisma.media.delete({ where: { id } });

    const storedFilename = media.url.replace(/^\/uploads\//, '');
    await unlink(join(UPLOAD_DIR, storedFilename)).catch(() => {
      // Datei bereits weg (z.B. manuell gelöscht) – DB-Zeile ist trotzdem entfernt.
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
