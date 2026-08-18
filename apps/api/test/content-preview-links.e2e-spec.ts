import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import * as argon2 from 'argon2';
import { PrismaService } from '../src/prisma/prisma.service';
import { createTestApp } from './setup-app';

describe('Content-Vorschau-Links (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let adminToken: string;
  let scopedToken: string;
  let contentId: string;

  const password = 'ChangeMe123!';
  const adminEmail = 'e2e-preview-links-admin@pivot.dev';
  const scopedEmail = 'e2e-preview-links-scoped@pivot.dev';
  const scopedRoleName = 'E2E Preview-Links Scoped Role';
  const contentTypeSlug = 'e2e-preview-links-type';

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
    await prisma.user.deleteMany({
      where: { email: { in: [adminEmail, scopedEmail] } },
    });
    await prisma.role.deleteMany({ where: { name: scopedRoleName } });
  }

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    await cleanup();

    const adminRole = await prisma.role.findFirstOrThrow({
      where: { name: 'Administrator' },
    });
    await prisma.user.create({
      data: {
        email: adminEmail,
        lastName: 'E2E Preview-Links Admin',
        userRoles: { create: { roleId: adminRole.id } },
        passwordHash: await argon2.hash(password),
      },
    });

    // Rolle ganz ohne content:read – belegt, dass Vorschau-Link-Endpoints
    // wie die übrigen Content-Endpoints permission-gated sind.
    const scopedRole = await prisma.role.create({ data: { name: scopedRoleName } });
    await prisma.user.create({
      data: {
        email: scopedEmail,
        lastName: 'E2E Preview-Links Scoped',
        userRoles: { create: { roleId: scopedRole.id } },
        passwordHash: await argon2.hash(password),
      },
    });

    const contentType = await prisma.contentType.create({
      data: {
        name: 'E2E Preview-Links Type',
        slug: contentTypeSlug,
        schema: { fields: [] },
      },
    });
    const adminUser = await prisma.user.findUniqueOrThrow({
      where: { email: adminEmail },
    });
    const content = await prisma.content.create({
      data: {
        title: 'E2E Preview-Links Content',
        slug: 'e2e-preview-links-content',
        contentTypeId: contentType.id,
        authorId: adminUser.id,
        status: 'DRAFT',
        data: { body: 'x' },
      },
    });
    contentId = content.id;

    const adminLogin = await request(app.getHttpServer())
      .post('/v1/auth/login')
      .send({ email: adminEmail, password })
      .expect(200);
    adminToken = adminLogin.body.accessToken;

    const scopedLogin = await request(app.getHttpServer())
      .post('/v1/auth/login')
      .send({ email: scopedEmail, password })
      .expect(200);
    scopedToken = scopedLogin.body.accessToken;
  });

  afterAll(async () => {
    await cleanup();
    await app.close();
  });

  it('POST /v1/content/:id/preview-links ohne Token liefert 401', async () => {
    await request(app.getHttpServer())
      .post(`/v1/content/${contentId}/preview-links`)
      .expect(401);
  });

  it('POST /v1/content/:id/preview-links ohne content:read liefert 403', async () => {
    await request(app.getHttpServer())
      .post(`/v1/content/${contentId}/preview-links`)
      .set('Authorization', `Bearer ${scopedToken}`)
      .expect(403);
  });

  it('GET /v1/content/preview/:token mit unbekanntem Token liefert 404', async () => {
    await request(app.getHttpServer())
      .get('/v1/content/preview/garantiert-nicht-existent')
      .expect(404);
  });

  let linkId: string;
  let previewToken: string;

  it('POST /v1/content/:id/preview-links legt einen Link an', async () => {
    const res = await request(app.getHttpServer())
      .post(`/v1/content/${contentId}/preview-links`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ expiresInHours: 24 })
      .expect(201);

    expect(res.body.token).toBeDefined();
    expect(res.body.id).toBeDefined();
    expect(new Date(res.body.expiresAt).getTime()).toBeGreaterThan(Date.now());
    linkId = res.body.id;
    previewToken = res.body.token;
  });

  it('GET /v1/content/:id/preview-links listet den Link inkl. Roh-Token (erneutes Kopieren)', async () => {
    const res = await request(app.getHttpServer())
      .get(`/v1/content/${contentId}/preview-links`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    const entry = res.body.find((l: { id: string }) => l.id === linkId);
    expect(entry).toBeDefined();
    expect(entry.token).toBe(previewToken);
    expect(entry.createdBy.lastName).toBe('E2E Preview-Links Admin');
  });

  it('PATCH /v1/content/:id/preview-links/:linkId ohne content:read liefert 403', async () => {
    await request(app.getHttpServer())
      .patch(`/v1/content/${contentId}/preview-links/${linkId}`)
      .set('Authorization', `Bearer ${scopedToken}`)
      .send({ expiresInHours: 24 })
      .expect(403);
  });

  it('PATCH /v1/content/:id/preview-links/:linkId verlängert die Gültigkeit, Token bleibt gleich', async () => {
    const before = await request(app.getHttpServer())
      .get(`/v1/content/${contentId}/preview-links`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    const beforeExpiry = new Date(
      before.body.find((l: { id: string }) => l.id === linkId).expiresAt,
    ).getTime();

    const res = await request(app.getHttpServer())
      .patch(`/v1/content/${contentId}/preview-links/${linkId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ expiresInHours: 720 })
      .expect(200);

    expect(res.body.token).toBe(previewToken);
    expect(new Date(res.body.expiresAt).getTime()).toBeGreaterThan(beforeExpiry);
  });

  it('PATCH /v1/content/:id/preview-links/:linkId mit unbekannter linkId liefert 404', async () => {
    await request(app.getHttpServer())
      .patch(`/v1/content/${contentId}/preview-links/garantiert-nicht-existent`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ expiresInHours: 24 })
      .expect(404);
  });

  it('GET /v1/content/preview/:token liefert den Inhalt ohne Login, unabhängig vom Status (DRAFT)', async () => {
    const res = await request(app.getHttpServer())
      .get(`/v1/content/preview/${previewToken}`)
      .expect(200);

    expect(res.body.id).toBe(contentId);
    expect(res.body.title).toBe('E2E Preview-Links Content');
    expect(res.body.status).toBe('DRAFT');
  });

  it('ein abgelaufener Link liefert 404', async () => {
    await prisma.contentPreviewToken.update({
      where: { id: linkId },
      data: { expiresAt: new Date(Date.now() - 60 * 1000) },
    });

    await request(app.getHttpServer())
      .get(`/v1/content/preview/${previewToken}`)
      .expect(404);
  });

  it('DELETE /v1/content/:id/preview-links/:linkId widerruft einen Link', async () => {
    // Neuen (noch gültigen) Link für den Widerruf-Test anlegen.
    const created = await request(app.getHttpServer())
      .post(`/v1/content/${contentId}/preview-links`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(201);

    await request(app.getHttpServer())
      .delete(`/v1/content/${contentId}/preview-links/${created.body.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    await request(app.getHttpServer())
      .get(`/v1/content/preview/${created.body.token}`)
      .expect(404);

    const list = await request(app.getHttpServer())
      .get(`/v1/content/${contentId}/preview-links`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(
      list.body.some((l: { id: string }) => l.id === created.body.id),
    ).toBe(false);
  });
});
