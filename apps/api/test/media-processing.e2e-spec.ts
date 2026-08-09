import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import * as argon2 from 'argon2';
import sharp from 'sharp';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { PrismaService } from '../src/prisma/prisma.service';
import { UPLOAD_DIR } from '../src/media/media.config';
import { createTestApp } from './setup-app';

describe('Medienverarbeitung & -verwaltung (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let accessToken: string;
  let twoByTwoPng: Buffer;

  const userEmail = 'e2e-media-processing-test@strasev.dev';
  const password = 'ChangeMe123!';

  async function cleanup() {
    await prisma.media.deleteMany({ where: { uploadedBy: { email: userEmail } } });
    await prisma.tag.deleteMany({ where: { slug: 'e2e-media-tag' } });
    await prisma.user.deleteMany({ where: { email: userEmail } });
  }

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    twoByTwoPng = await sharp({
      create: { width: 2, height: 2, channels: 3, background: { r: 10, g: 20, b: 30 } },
    })
      .png()
      .toBuffer();

    await cleanup();

    const editorRole = await prisma.role.findFirstOrThrow({ where: { name: 'Editor' } });
    await prisma.user.create({
      data: {
        email: userEmail,
        lastName: 'E2E Media Processing Test',
        roleId: editorRole.id,
        passwordHash: await argon2.hash(password),
      },
    });

    const login = await request(app.getHttpServer())
      .post('/v1/auth/login')
      .send({ email: userEmail, password })
      .expect(200);
    accessToken = login.body.accessToken;
  });

  afterAll(async () => {
    await cleanup();
    await app.close();
  });

  function auth() {
    return { Authorization: `Bearer ${accessToken}` };
  }

  let mediaId: string;

  it('normalisiert ein hochgeladenes Bild (Dimensionen ermittelt, EXIF-frei)', async () => {
    const res = await request(app.getHttpServer())
      .post('/v1/media')
      .set(auth())
      .attach('file', twoByTwoPng, { filename: 'e2e.png', contentType: 'image/png' })
      .expect(201);
    mediaId = res.body.id;
    expect(res.body.width).toBe(2);
    expect(res.body.height).toBe(2);
  });

  it('generiert ein quadratisches 400x400-Thumbnail', async () => {
    const res = await request(app.getHttpServer())
      .get(`/v1/media?folderId=root`)
      .set(auth())
      .expect(200);
    const media = res.body.items.find((m: { id: string }) => m.id === mediaId);
    expect(media.thumbnailUrl).toMatch(/^\/uploads\/.+\.png$/);

    // Statische Datei-Auslieferung (`useStaticAssets`) läuft nicht im
    // Test-Bootstrap (setup-app.ts) – Datei direkt von Disk lesen statt
    // per HTTP abzurufen.
    const thumbBuffer = await readFile(
      join(UPLOAD_DIR, media.thumbnailUrl.replace(/^\/uploads\//, '')),
    );
    const meta = await sharp(thumbBuffer).metadata();
    expect(meta.width).toBe(400);
    expect(meta.height).toBe(400);
  });

  it('lehnt eine als Bild deklarierte, nicht-dekodierbare Datei mit 400 ab', async () => {
    await request(app.getHttpServer())
      .post('/v1/media')
      .set(auth())
      .attach('file', Buffer.from('not-a-real-image'), {
        filename: 'broken.png',
        contentType: 'image/png',
      })
      .expect(400);
  });

  it('lehnt einen nicht erlaubten Dateityp mit 400 ab', async () => {
    await request(app.getHttpServer())
      .post('/v1/media')
      .set(auth())
      .attach('file', Buffer.from('MZ'), {
        filename: 'evil.exe',
        contentType: 'application/x-msdownload',
      })
      .expect(400);
  });

  it('erlaubt PDF-Upload (keine Bildverarbeitung, keine Dimensionen)', async () => {
    const res = await request(app.getHttpServer())
      .post('/v1/media')
      .set(auth())
      .attach('file', Buffer.from('%PDF-1.4\n%%EOF'), {
        filename: 'e2e.pdf',
        contentType: 'application/pdf',
      })
      .expect(201);
    expect(res.body.mimeType).toBe('application/pdf');
    expect(res.body.width).toBeNull();

    const filterRes = await request(app.getHttpServer())
      .get('/v1/media?type=pdf')
      .set(auth())
      .expect(200);
    expect(filterRes.body.items.some((m: { id: string }) => m.id === res.body.id)).toBe(true);

    await request(app.getHttpServer())
      .delete(`/v1/media/${res.body.id}`)
      .set(auth())
      .expect(200);
  });

  it('lehnt einen Zuschnitt außerhalb der Bildgrenzen mit 400 ab', async () => {
    await request(app.getHttpServer())
      .post(`/v1/media/${mediaId}/crop`)
      .set(auth())
      .send({ x: 0, y: 0, width: 100, height: 100 })
      .expect(400);
  });

  let croppedId: string;

  it('erzeugt beim Zuschneiden ein neues Medium, Original bleibt bestehen', async () => {
    const res = await request(app.getHttpServer())
      .post(`/v1/media/${mediaId}/crop`)
      .set(auth())
      .send({ x: 0, y: 0, width: 1, height: 1 })
      .expect(201);
    croppedId = res.body.id;
    expect(croppedId).not.toBe(mediaId);
    expect(res.body.width).toBe(1);
    expect(res.body.height).toBe(1);

    const original = await prisma.media.findUnique({ where: { id: mediaId } });
    expect(original).not.toBeNull();
  });

  it('setzt einen Fokuspunkt per PATCH', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/v1/media/${mediaId}`)
      .set(auth())
      .send({ focalX: 0.25, focalY: 0.75 })
      .expect(200);
    expect(res.body.focalX).toBe(0.25);
    expect(res.body.focalY).toBe(0.75);
  });

  it('weist ein Tag zu und filtert danach', async () => {
    const tag = await prisma.tag.create({
      data: { name: 'E2E Media Tag', slug: 'e2e-media-tag' },
    });

    await request(app.getHttpServer())
      .patch(`/v1/media/${mediaId}`)
      .set(auth())
      .send({ tagIds: [tag.id] })
      .expect(200)
      .expect((res) => {
        expect(res.body.tags).toEqual([
          { id: tag.id, name: tag.name, slug: tag.slug },
        ]);
      });

    const filterRes = await request(app.getHttpServer())
      .get(`/v1/media?tagIds=${tag.id}`)
      .set(auth())
      .expect(200);
    expect(filterRes.body.items.some((m: { id: string }) => m.id === mediaId)).toBe(true);
  });

  it('dupliziert ein Medium mit unabhängiger Datei', async () => {
    const res = await request(app.getHttpServer())
      .post(`/v1/media/${mediaId}/duplicate`)
      .set(auth())
      .expect(201);
    expect(res.body.id).not.toBe(mediaId);
    expect(res.body.url).not.toBe(
      (await prisma.media.findUniqueOrThrow({ where: { id: mediaId } })).url,
    );

    await request(app.getHttpServer())
      .delete(`/v1/media/${res.body.id}`)
      .set(auth())
      .expect(200);
  });

  it('GET /v1/media/unused erkennt unreferenzierte Medien', async () => {
    const res = await request(app.getHttpServer())
      .get('/v1/media/unused')
      .set(auth())
      .expect(200);
    expect(res.body.items.some((m: { id: string }) => m.id === mediaId)).toBe(true);
    expect(res.body.items.some((m: { id: string }) => m.id === croppedId)).toBe(true);
  });
});
