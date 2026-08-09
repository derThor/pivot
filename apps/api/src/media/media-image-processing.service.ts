import { Injectable } from '@nestjs/common';
import sharp from 'sharp';

// Mimetypes, für die die Pipeline (Normalisierung + Varianten) läuft.
// gif (Animation würde durch Resize zerstört) und svg (vektoriell, bereits
// auflösungsunabhängig) werden bewusst unverändert gespeichert.
const RASTER_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

export const RESPONSIVE_BREAKPOINTS = [320, 640, 1024, 1920] as const;
export const VARIANT_FORMATS = ['webp', 'avif'] as const;
export type VariantFormat = (typeof VARIANT_FORMATS)[number];

// Deckelt überdimensionierte Uploads (z.B. Kamera-Originale) an der
// längsten Kante, um Speicher-/Verarbeitungskosten zu begrenzen.
const MAX_DIMENSION = 4000;

export interface GeneratedVariant {
  width: number;
  format: VariantFormat;
  buffer: Buffer;
  size: number;
}

export interface CropRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface FocalPoint {
  x: number;
  y: number;
}

// Feste Kantenlänge des quadratischen Thumbnails (Medienbibliothek-Grid,
// Seiten-Designer-Baustein "Kacheln").
export const THUMBNAIL_SIZE = 400;

@Injectable()
export class MediaImageProcessingService {
  isProcessable(mimeType: string): boolean {
    return RASTER_MIME_TYPES.has(mimeType);
  }

  // gif zusätzlich zu den regulär verarbeitbaren Typen: für ein
  // statisches Thumbnail (erstes Frame) ist Animation nicht nötig, im
  // Gegensatz zu Normalisierung/Responsive-Varianten (siehe
  // isProcessable), wo eine Animation dabei zerstört würde.
  isThumbnailable(mimeType: string): boolean {
    return this.isProcessable(mimeType) || mimeType === 'image/gif';
  }

  /**
   * Richtet die EXIF-Rotation fest im Bild aus und verwirft danach alle
   * Metadaten (sharp schreibt ohne explizites `.withMetadata()` keine
   * Metadaten in die Ausgabe) – das entfernt EXIF-Daten inkl. GPS.
   * Gleichzeitig eine Re-Kompression, die die Dateigröße meist senkt.
   */
  async normalize(buffer: Buffer): Promise<Buffer> {
    return sharp(buffer)
      .rotate()
      .resize({
        width: MAX_DIMENSION,
        height: MAX_DIMENSION,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .toBuffer();
  }

  async getDimensions(
    buffer: Buffer,
  ): Promise<{ width: number | null; height: number | null }> {
    const meta = await sharp(buffer).metadata();
    return { width: meta.width ?? null, height: meta.height ?? null };
  }

  /**
   * Erzeugt WebP/AVIF-Varianten an festen Breakpoints, jeweils nicht
   * breiter als das Quellbild (kein Hochskalieren).
   */
  async generateVariants(
    buffer: Buffer,
    sourceWidth: number,
  ): Promise<GeneratedVariant[]> {
    const breakpoints = RESPONSIVE_BREAKPOINTS.filter((w) => w < sourceWidth);
    const variants: GeneratedVariant[] = [];

    for (const width of breakpoints) {
      for (const format of VARIANT_FORMATS) {
        const pipeline = sharp(buffer).resize({ width, withoutEnlargement: true });
        const output =
          format === 'webp'
            ? pipeline.webp({ quality: 80 })
            : pipeline.avif({ quality: 60 });
        const outBuffer = await output.toBuffer();
        variants.push({ width, format, buffer: outBuffer, size: outBuffer.length });
      }
    }

    return variants;
  }

  /**
   * Quadratischer Zuschnitt fester Kantenlänge (`THUMBNAIL_SIZE`),
   * zentriert auf den Fokuspunkt (Default Bildmitte). Der Ausschnitt ist
   * die größtmögliche quadratische Fläche, die innerhalb des Bilds um den
   * Fokuspunkt liegt (an die Bildgrenzen geclampt), danach auf
   * `THUMBNAIL_SIZE` skaliert.
   */
  async generateSquareThumbnail(
    buffer: Buffer,
    sourceWidth: number,
    sourceHeight: number,
    focal?: FocalPoint,
  ): Promise<Buffer> {
    const side = Math.min(sourceWidth, sourceHeight);
    const focalX = focal?.x ?? 0.5;
    const focalY = focal?.y ?? 0.5;
    const left = Math.min(
      Math.max(Math.round(focalX * sourceWidth - side / 2), 0),
      sourceWidth - side,
    );
    const top = Math.min(
      Math.max(Math.round(focalY * sourceHeight - side / 2), 0),
      sourceHeight - side,
    );

    // Immer als PNG ausgegeben (unabhängig vom Quellformat) – vermeidet
    // Format-Erkennung/-Fallstricke (z.B. gif-Encoding) und JPEG-Artefakte
    // bei der kleinen Zielgröße; der Größenunterschied ist bei 400×400px
    // vernachlässigbar.
    return sharp(buffer)
      .extract({ left, top, width: side, height: side })
      .resize({ width: THUMBNAIL_SIZE, height: THUMBNAIL_SIZE })
      .png()
      .toBuffer();
  }

  async crop(buffer: Buffer, rect: CropRect): Promise<Buffer> {
    return sharp(buffer)
      .extract({
        left: Math.round(rect.x),
        top: Math.round(rect.y),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
      })
      .toBuffer();
  }
}
