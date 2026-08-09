import { BadRequestException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { extname, join } from 'node:path';
import { diskStorage } from 'multer';
import type { Request } from 'express';

export const UPLOAD_DIR = join(process.cwd(), 'uploads');

export const ALLOWED_MIME_TYPES = new Set([
  // Bilder
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml',
  // PDF
  'application/pdf',
  // Video
  'video/mp4',
  'video/webm',
  'video/quicktime',
  // Office (Word/Excel/PowerPoint, alte + OOXML-Formate)
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
]);

// Multer kennt beim `fileFilter` die endgültige Dateigröße noch nicht
// (Stream ist noch nicht konsumiert) – das globale `limits.fileSize`
// deckt daher nur die größte erlaubte Kategorie (Video) ab. Die
// eigentliche, kategoriespezifische Prüfung erfolgt danach in
// `MediaService.create()` anhand der geschriebenen Datei.
const MAX_FILE_SIZE = 200 * 1024 * 1024; // 200 MB (Video-Obergrenze)

export function maxSizeForMimeType(mimeType: string): number {
  if (mimeType.startsWith('video/')) return 200 * 1024 * 1024;
  if (mimeType.startsWith('image/')) return 10 * 1024 * 1024;
  return 25 * 1024 * 1024; // PDF/Office
}

// Muss mit mediaCategory() in apps/web/src/lib/media-type.ts synchron
// gehalten werden.
export type MediaCategory = 'image' | 'pdf' | 'video' | 'office' | 'other';

export function mediaCategoryForMimeType(mimeType: string): MediaCategory {
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType === 'application/pdf') return 'pdf';
  if (mimeType.startsWith('video/')) return 'video';
  if (
    mimeType === 'application/msword' ||
    mimeType === 'application/vnd.ms-excel' ||
    mimeType === 'application/vnd.ms-powerpoint' ||
    mimeType.startsWith('application/vnd.openxmlformats-officedocument.')
  ) {
    return 'office';
  }
  return 'other';
}

export function mimeTypesForCategory(category: MediaCategory): string[] {
  return [...ALLOWED_MIME_TYPES].filter(
    (mimeType) => mediaCategoryForMimeType(mimeType) === category,
  );
}

export const multerOptions = {
  storage: diskStorage({
    destination: UPLOAD_DIR,
    filename: (
      _req: Request,
      file: Express.Multer.File,
      callback: (error: Error | null, filename: string) => void,
    ) => {
      callback(null, `${randomUUID()}${extname(file.originalname)}`);
    },
  }),
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (
    _req: Request,
    file: Express.Multer.File,
    callback: (error: Error | null, accept: boolean) => void,
  ) => {
    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      callback(
        new BadRequestException(
          `Dateityp ${file.mimetype} wird nicht unterstützt.`,
        ),
        false,
      );
      return;
    }
    callback(null, true);
  },
};
