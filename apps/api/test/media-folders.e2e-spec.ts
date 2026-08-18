import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import * as argon2 from 'argon2';
import { PrismaService } from '../src/prisma/prisma.service';
import { createTestApp } from './setup-app';

describe('Medien-Ordner-Flow (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let accessToken: string;

  const userEmail = 'e2e-media-folders-test@pivot.dev';
  const password = 'ChangeMe123!';
  const rootFolderName = 'E2E Medien-Ordner Test';

  async function cleanup() {
    // Medien des Test-Users unabhängig vom Ordner löschen (ein Test
    // verschiebt das Bild wieder aus dem Ordner heraus, bevor er den
    // Ordner löscht – danach würde ein reiner Ordner-Filter das Bild
    // nicht mehr finden, und die User-Löschung würde an der
    // media_uploadedById_fkey scheitern).
    await prisma.media.deleteMany({
      where: { uploadedBy: { email: userEmail } },
    });

    const folders = await prisma.mediaFolder.findMany({
      where: { name: { startsWith: 'E2E Medien-Ordner' } },
    });
    if (folders.length > 0) {
      // Unterordner vor Elternordnern löschen (FK-Reihenfolge).
      await prisma.mediaFolder.deleteMany({
        where: { id: { in: folders.map((f) => f.id) }, parentId: { not: null } },
      });
      await prisma.mediaFolder.deleteMany({
        where: { id: { in: folders.map((f) => f.id) } },
      });
    }
    await prisma.user.deleteMany({ where: { email: userEmail } });
  }

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);

    await cleanup();

    const editorRole = await prisma.role.findFirstOrThrow({
      where: { name: 'Chefredaktion' },
    });
    await prisma.user.create({
      data: {
        email: userEmail,
        lastName: 'E2E Media Folders Test',
        userRoles: { create: { roleId: editorRole.id } },
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

  let folderId: string;
  let subFolderId: string;

  it('legt einen Ordner an', async () => {
    const res = await request(app.getHttpServer())
      .post('/v1/media-folders')
      .set(auth())
      .send({ name: rootFolderName })
      .expect(201);
    folderId = res.body.id;
    expect(res.body.parentId).toBeNull();
  });

  it('lehnt einen zweiten Ordner mit gleichem Namen im selben Elternordner ab (409)', async () => {
    await request(app.getHttpServer())
      .post('/v1/media-folders')
      .set(auth())
      .send({ name: rootFolderName })
      .expect(409);
  });

  it('legt einen Unterordner an', async () => {
    const res = await request(app.getHttpServer())
      .post('/v1/media-folders')
      .set(auth())
      .send({ name: 'E2E Medien-Ordner Unterordner', parentId: folderId })
      .expect(201);
    subFolderId = res.body.id;
    expect(res.body.parentId).toBe(folderId);
  });

  it('lädt ein Bild in den Unterordner hoch', async () => {
    // Echte (wenn auch minimale) PNG-Bytes nötig – seit der
    // Upload-Verarbeitungs-Pipeline (siehe media-processing-and-management.md)
    // versucht MediaService.create() jedes image/*-Upload mit sharp zu
    // normalisieren; nicht-dekodierbare Fake-Bytes würden mit 400
    // abgelehnt statt (wie früher) unverändert durchgereicht.
    const onePixelPng = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
      'base64',
    );
    const res = await request(app.getHttpServer())
      .post('/v1/media')
      .set(auth())
      .field('folderId', subFolderId)
      .attach('file', onePixelPng, {
        filename: 'e2e-test.png',
        contentType: 'image/png',
      })
      .expect(201);
    expect(res.body.folderId).toBe(subFolderId);
  });

  it('GET /v1/media?folderId=<id> filtert auf den Ordner', async () => {
    const res = await request(app.getHttpServer())
      .get(`/v1/media?folderId=${subFolderId}`)
      .set(auth())
      .expect(200);
    expect(res.body.meta.total).toBe(1);
    expect(res.body.items[0].folderId).toBe(subFolderId);
  });

  it('lehnt Verschieben eines Ordners in seinen eigenen Nachfahren ab (400)', async () => {
    await request(app.getHttpServer())
      .patch(`/v1/media-folders/${folderId}`)
      .set(auth())
      .send({ parentId: subFolderId })
      .expect(400);
  });

  it('löscht einen nicht-leeren Ordner kaskadierend inkl. Unterordner und Medien', async () => {
    const media = await request(app.getHttpServer())
      .get(`/v1/media?folderId=${subFolderId}`)
      .set(auth())
      .expect(200);
    const mediaId = media.body.items[0].id;

    await request(app.getHttpServer())
      .delete(`/v1/media-folders/${folderId}`)
      .set(auth())
      .expect(200);

    const remainingFolders = await request(app.getHttpServer())
      .get('/v1/media-folders')
      .set(auth())
      .expect(200);
    expect(
      remainingFolders.body.some((f: { id: string }) => f.id === folderId),
    ).toBe(false);
    expect(
      remainingFolders.body.some((f: { id: string }) => f.id === subFolderId),
    ).toBe(false);

    const deletedMedia = await prisma.media.findUnique({
      where: { id: mediaId },
    });
    expect(deletedMedia).toBeNull();
  });

  it('lehnt Löschen eines Systemordners ab (400), auch wenn leer', async () => {
    const systemFolder = await prisma.mediaFolder.create({
      data: { name: 'E2E Medien-Ordner Systemordner', isSystem: true },
    });

    await request(app.getHttpServer())
      .delete(`/v1/media-folders/${systemFolder.id}`)
      .set(auth())
      .expect(400);

    const stillExists = await prisma.mediaFolder.findUnique({
      where: { id: systemFolder.id },
    });
    expect(stillExists).not.toBeNull();

    await prisma.mediaFolder.delete({ where: { id: systemFolder.id } });
  });
});
