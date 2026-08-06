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
  const adminEmail = 'e2e-global-search-admin@strasev.dev';
  const scopedEmail = 'e2e-global-search-scoped@strasev.dev';
  const password = 'ChangeMe123!';
  const contentTypeSlug = 'e2e-global-search-type';
  const scopedRoleName = 'E2E Global Search Scoped Role';

  let categoryId: string;
  let tagId: string;
  let mediaId: string;
  let contentId: string;

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
      where: { email: { in: [adminEmail, scopedEmail] } },
    });
    await prisma.role.deleteMany({ where: { name: scopedRoleName } });
  }

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    await cleanup();

    const adminRole = await prisma.role.findFirstOrThrow({
      where: { name: 'Admin' },
    });
    await prisma.user.create({
      data: {
        email: adminEmail,
        lastName: 'E2E Global Search Admin',
        roleId: adminRole.id,
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
        roleId: scopedRole.id,
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

  it('Admin findet Treffer über alle vier Bereiche (Inhalt, Kategorie, Tag, Medium)', async () => {
    const res = await request(app.getHttpServer())
      .get('/v1/search')
      .query({ q: token, limit: 10 })
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    const types = res.body.map((r: { type: string }) => r.type).sort();
    expect(types).toEqual(['category', 'content', 'media', 'tag']);

    expect(
      res.body.find((r: { type: string }) => r.type === 'content').id,
    ).toBe(contentId);
    expect(
      res.body.find((r: { type: string }) => r.type === 'category').id,
    ).toBe(categoryId);
    expect(res.body.find((r: { type: string }) => r.type === 'tag').id).toBe(
      tagId,
    );
    expect(
      res.body.find((r: { type: string }) => r.type === 'media').id,
    ).toBe(mediaId);
  });

  it('Nutzer mit nur content:read sieht ausschließlich Content-Treffer', async () => {
    const res = await request(app.getHttpServer())
      .get('/v1/search')
      .query({ q: token, limit: 10 })
      .set('Authorization', `Bearer ${contentOnlyToken}`)
      .expect(200);

    expect(res.body.length).toBeGreaterThan(0);
    expect(
      res.body.every((r: { type: string }) => r.type === 'content'),
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
