import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import * as argon2 from 'argon2';
import { Role } from '@strasev/database';
import { PrismaService } from '../src/prisma/prisma.service';
import { createTestApp } from './setup-app';

describe('Content-Flow (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let accessToken: string;

  const userEmail = 'e2e-content-test@strasev.dev';
  const password = 'ChangeMe123!';
  const contentTypeSlug = 'e2e-test-type';

  async function cleanup() {
    const contentType = await prisma.contentType.findUnique({
      where: { slug: contentTypeSlug },
    });
    if (contentType) {
      await prisma.content.deleteMany({
        where: { contentTypeId: contentType.id },
      });
      await prisma.contentType.delete({ where: { id: contentType.id } });
    }
    await prisma.user.deleteMany({ where: { email: userEmail } });
  }

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);

    await cleanup();

    await prisma.user.create({
      data: {
        email: userEmail,
        name: 'E2E Content Test',
        role: Role.ADMIN,
        passwordHash: await argon2.hash(password),
      },
    });
    await prisma.contentType.create({
      data: {
        name: 'E2E Test Type',
        slug: contentTypeSlug,
        schema: { fields: [{ name: 'body', type: 'string', required: true }] },
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

  it('POST /v1/content ohne Token liefert 401', async () => {
    await request(app.getHttpServer())
      .post('/v1/content')
      .send({ title: 'x', slug: 'x', contentTypeId: 'irrelevant', data: {} })
      .expect(401);
  });

  let createdId: string;

  it('POST /v1/content legt einen Content-Eintrag als DRAFT an', async () => {
    const contentType = await prisma.contentType.findUniqueOrThrow({
      where: { slug: contentTypeSlug },
    });

    const res = await request(app.getHttpServer())
      .post('/v1/content')
      .set(auth())
      .send({
        title: 'E2E Testeintrag',
        slug: 'e2e-testeintrag',
        contentTypeId: contentType.id,
        data: { body: 'Hallo Welt' },
      })
      .expect(201);

    expect(res.body.status).toBe('DRAFT');
    expect(res.body.publishedAt).toBeNull();
    createdId = res.body.id;
  });

  it('GET /v1/content liefert die Liste inkl. contentType-Relation', async () => {
    const res = await request(app.getHttpServer())
      .get('/v1/content')
      .set(auth())
      .expect(200);

    const entry = res.body.items.find(
      (item: { id: string }) => item.id === createdId,
    );
    expect(entry).toBeDefined();
    // Regressionstest: contentType wurde in ContentService.findAll() zunächst
    // nicht mitgeladen, was im Frontend zu einem Rendering-Fehler führte.
    expect(entry.contentType).toBeDefined();
    expect(entry.contentType.slug).toBe(contentTypeSlug);
  });

  it('GET /v1/content/:id liefert den einzelnen Eintrag', async () => {
    const res = await request(app.getHttpServer())
      .get(`/v1/content/${createdId}`)
      .set(auth())
      .expect(200);

    expect(res.body.title).toBe('E2E Testeintrag');
    expect(res.body.contentType).toBeDefined();
  });

  it('PATCH /v1/content/:id auf PUBLISHED setzt publishedAt und legt eine Version an', async () => {
    const versionsBefore = await prisma.contentVersion.count({
      where: { contentId: createdId },
    });

    const res = await request(app.getHttpServer())
      .patch(`/v1/content/${createdId}`)
      .set(auth())
      .send({ status: 'PUBLISHED' })
      .expect(200);

    expect(res.body.status).toBe('PUBLISHED');
    expect(res.body.publishedAt).not.toBeNull();

    const versionsAfter = await prisma.contentVersion.count({
      where: { contentId: createdId },
    });
    expect(versionsAfter).toBe(versionsBefore + 1);
  });

  it('DELETE /v1/content/:id entfernt den Eintrag', async () => {
    await request(app.getHttpServer())
      .delete(`/v1/content/${createdId}`)
      .set(auth())
      .expect(200);

    await request(app.getHttpServer())
      .get(`/v1/content/${createdId}`)
      .set(auth())
      .expect(404);
  });
});
