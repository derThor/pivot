import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import * as argon2 from 'argon2';
import { PrismaService } from '../src/prisma/prisma.service';
import { createTestApp } from './setup-app';

describe('Globale Suche (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let adminToken: string;
  let contentOnlyToken: string;

  const token = 'zzzglobalsearchmarker';
  const adminEmail = 'e2e-global-search-admin@pivot.dev';
  const scopedEmail = 'e2e-global-search-scoped@pivot.dev';
  const password = 'ChangeMe123!';
  const contentTypeSlug = 'e2e-global-search-type';
  const scopedRoleName = 'E2E Global Search Scoped Role';

  let categoryId: string;
  let tagId: string;
  let mediaId: string;
  let contentId: string;
  let previewLinkId: string;
  let targetUserId: string;
  let targetRoleId: string;

  const targetUserEmail = `${token}@pivot.dev`;
  const targetRoleName = `${token} Rolle`;

  async function cleanup() {
    await prisma.content.deleteMany({ where: { slug: `${token}-slug` } });
    const contentType = await prisma.contentType.findUnique({
      where: { slug: contentTypeSlug },
    });
    if (contentType) {
      await prisma.contentType.delete({ where: { id: contentType.id } });
    }
    await prisma.category.deleteMany({ where: { slug: `${token}-kategorie` } });
    await prisma.tag.deleteMany({ where: { slug: `${token}-tag` } });
    await prisma.media.deleteMany({ where: { filename: { startsWith: token } } });
    await prisma.user.deleteMany({
      where: { email: { in: [adminEmail, scopedEmail, targetUserEmail] } },
    });
    await prisma.role.deleteMany({
      where: { name: { in: [scopedRoleName, targetRoleName] } },
    });
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
        lastName: 'E2E Global Search Admin',
        userRoles: { create: { roleId: adminRole.id } },
        passwordHash: await argon2.hash(password),
      },
    });

    const scopedRole = await prisma.role.create({ data: { name: scopedRoleName } });
    const contentReadPermission = await prisma.permission.findUniqueOrThrow({
      where: { resource_action: { resource: 'content', action: 'read' } },
    });
    await prisma.rolePermission.create({
      data: { roleId: scopedRole.id, permissionId: contentReadPermission.id },
    });
    await prisma.user.create({
      data: {
        email: scopedEmail,
        lastName: 'E2E Global Search Scoped',
        userRoles: { create: { roleId: scopedRole.id } },
        passwordHash: await argon2.hash(password),
      },
    });

    const contentType = await prisma.contentType.create({
      data: {
        name: 'E2E Global Search Type',
        slug: contentTypeSlug,
        schema: { fields: [] },
      },
    });
    const adminUser = await prisma.user.findUniqueOrThrow({
      where: { email: adminEmail },
    });
    const content = await prisma.content.create({
      data: {
        title: `${token} Inhalt`,
        slug: `${token}-slug`,
        contentTypeId: contentType.id,
        authorId: adminUser.id,
        data: { body: 'x' },
      },
    });
    contentId = content.id;

    const previewLink = await prisma.contentPreviewToken.create({
      data: {
        token: `${token}-preview-token`,
        contentId: content.id,
        createdById: adminUser.id,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });
    previewLinkId = previewLink.id;

    const category = await prisma.category.create({
      data: { name: `${token} Kategorie`, slug: `${token}-kategorie` },
    });
    categoryId = category.id;

    const tag = await prisma.tag.create({
      data: { name: `${token} Tag`, slug: `${token}-tag` },
    });
    tagId = tag.id;

    const media = await prisma.media.create({
      data: {
        filename: `${token}-bild.png`,
        url: `/uploads/${token}-bild.png`,
        mimeType: 'image/png',
        size: 1,
        uploadedById: adminUser.id,
      },
    });
    mediaId = media.id;

    const targetRole = await prisma.role.create({
      data: { name: targetRoleName, description: `${token} Beschreibung` },
    });
    targetRoleId = targetRole.id;

    const targetUser = await prisma.user.create({
      data: {
        email: targetUserEmail,
        firstName: token,
        lastName: 'Zielbenutzer',
        userRoles: { create: { roleId: adminRole.id } },
        passwordHash: await argon2.hash(password),
      },
    });
    targetUserId = targetUser.id;

    const adminLogin = await request(app.getHttpServer())
      .post('/v1/auth/login')
      .send({ email: adminEmail, password })
      .expect(200);
    adminToken = adminLogin.body.accessToken;

    const scopedLogin = await request(app.getHttpServer())
      .post('/v1/auth/login')
      .send({ email: scopedEmail, password })
      .expect(200);
    contentOnlyToken = scopedLogin.body.accessToken;
  });

  afterAll(async () => {
    await cleanup();
    await app.close();
  });

  it('GET /v1/search ohne Token liefert 401', async () => {
    await request(app.getHttpServer())
      .get('/v1/search')
      .query({ q: token })
      .expect(401);
  });

  it('GET /v1/search ohne q liefert 400', async () => {
    await request(app.getHttpServer())
      .get('/v1/search')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(400);
  });

  it('Admin findet Treffer über alle sieben Bereiche (Inhalt, Vorschau-Link, Kategorie, Tag, Medium, Benutzer, Rolle)', async () => {
    const res = await request(app.getHttpServer())
      .get('/v1/search')
      .query({ q: token, limit: 10 })
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    const types = res.body.map((r: { type: string }) => r.type).sort();
    expect(types).toEqual([
      'category',
      'content',
      'media',
      'previewLink',
      'role',
      'tag',
      'user',
    ]);

    expect(
      res.body.find((r: { type: string }) => r.type === 'content').id,
    ).toBe(contentId);
    expect(
      res.body.find((r: { type: string }) => r.type === 'previewLink').id,
    ).toBe(previewLinkId);
    expect(
      res.body.find((r: { type: string }) => r.type === 'category').id,
    ).toBe(categoryId);
    expect(res.body.find((r: { type: string }) => r.type === 'tag').id).toBe(
      tagId,
    );
    expect(
      res.body.find((r: { type: string }) => r.type === 'media').id,
    ).toBe(mediaId);
    expect(
      res.body.find((r: { type: string }) => r.type === 'user').id,
    ).toBe(targetUserId);
    expect(
      res.body.find((r: { type: string }) => r.type === 'role').id,
    ).toBe(targetRoleId);
  });

  it('Nutzer mit nur content:read sieht ausschließlich Content- und Vorschau-Link-Treffer', async () => {
    const res = await request(app.getHttpServer())
      .get('/v1/search')
      .query({ q: token, limit: 10 })
      .set('Authorization', `Bearer ${contentOnlyToken}`)
      .expect(200);

    expect(res.body.length).toBeGreaterThan(0);
    expect(
      res.body.every(
        (r: { type: string }) =>
          r.type === 'content' || r.type === 'previewLink',
      ),
    ).toBe(true);
  });

  it('Präfix-Suche mit 3 Zeichen findet den vollen Begriff (Live-Suche-UX)', async () => {
    const prefix = token.slice(0, 3);
    const res = await request(app.getHttpServer())
      .get('/v1/search')
      .query({ q: prefix, limit: 10 })
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(res.body.length).toBeGreaterThan(0);
  });
});
