import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import * as argon2 from 'argon2';
import { PrismaService } from '../src/prisma/prisma.service';
import { createTestApp } from './setup-app';

/**
 * Deckt die `:id/page`-Endpoints ab, die die globale Suche nutzt, um
 * beim Klick auf einen Treffer direkt zur richtigen Seite einer
 * paginierten Listen-Ansicht zu springen (siehe knowledge-base/content/
 * global-search.md, Update "Deep-Link + Wort-Markierung +
 * Pagination-Sprung"). Jeder Test berechnet die erwartete Seite direkt
 * per Prisma (derselbe Rang-Ansatz wie der Endpoint selbst) unmittelbar
 * vor genau EINEM API-Aufruf – ein Vergleich zwischen zwei separaten,
 * nacheinander ausgeführten API-Aufrufen wäre unter paralleler
 * Jest-Ausführung (andere e2e-Spec-Dateien legen währenddessen selbst
 * Rollen/Nutzer an) anfällig für Flakiness, da sich der globale Rang
 * zwischen den beiden Aufrufen verschieben kann.
 */
describe('Pagination-Sprung für Suchtreffer (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let adminToken: string;

  const token = 'zzzfindpagemarker';
  const adminEmail = 'e2e-find-page-admin@pivot.dev';
  const password = 'ChangeMe123!';
  const contentTypeSlug = 'e2e-find-page-type';

  async function cleanup() {
    await prisma.category.deleteMany({ where: { name: { startsWith: token } } });
    await prisma.tag.deleteMany({ where: { name: { startsWith: token } } });
    await prisma.role.deleteMany({ where: { name: { startsWith: token } } });
    await prisma.media.deleteMany({ where: { filename: { startsWith: token } } });
    const contentType = await prisma.contentType.findUnique({
      where: { slug: contentTypeSlug },
    });
    if (contentType) {
      await prisma.content.deleteMany({ where: { contentTypeId: contentType.id } });
      await prisma.contentType.delete({ where: { id: contentType.id } });
    }
    await prisma.user.deleteMany({
      where: { OR: [{ email: adminEmail }, { firstName: token }] },
    });
  }

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    await cleanup();

    const adminRole = await prisma.role.findFirstOrThrow({
      where: { name: 'Administrator' },
    });
    const adminUser = await prisma.user.create({
      data: {
        email: adminEmail,
        lastName: 'E2E Find-Page Admin',
        userRoles: { create: { roleId: adminRole.id } },
        passwordHash: await argon2.hash(password),
      },
    });

    const adminLogin = await request(app.getHttpServer())
      .post('/v1/auth/login')
      .send({ email: adminEmail, password })
      .expect(200);
    adminToken = adminLogin.body.accessToken;

    await prisma.category.create({
      data: { name: `${token} Kategorie`, slug: `${token}-cat` },
    });
    await prisma.tag.create({
      data: { name: `${token} Tag`, slug: `${token}-tag` },
    });
    await prisma.role.create({ data: { name: `${token} Rolle` } });

    const contentType = await prisma.contentType.create({
      data: { name: 'E2E Find-Page Type', slug: contentTypeSlug, schema: { fields: [] } },
    });
    const content = await prisma.content.create({
      data: {
        title: `${token} Inhalt`,
        slug: `${token}-content`,
        contentTypeId: contentType.id,
        authorId: adminUser.id,
        data: { body: 'x' },
      },
    });
    await prisma.media.create({
      data: {
        filename: `${token}.png`,
        url: `/uploads/${token}.png`,
        mimeType: 'image/png',
        size: 1,
        uploadedById: adminUser.id,
      },
    });
    await prisma.contentPreviewToken.create({
      data: {
        token: `${token}-preview`,
        contentId: content.id,
        createdById: adminUser.id,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });
  });

  afterAll(async () => {
    await cleanup();
    await app.close();
  });

  it('GET /v1/categories/:id/page ohne Token liefert 401', async () => {
    const category = await prisma.category.findFirstOrThrow({
      where: { name: { startsWith: token } },
    });
    await request(app.getHttpServer())
      .get(`/v1/categories/${category.id}/page`)
      .expect(401);
  });

  it('GET /v1/categories/:id/page liefert dieselbe Seite wie eine direkt berechnete Rangabfrage', async () => {
    const pageSize = 20;
    const category = await prisma.category.findFirstOrThrow({
      where: { name: { startsWith: token } },
    });
    const rank = await prisma.category.count({
      where: { name: { lt: category.name } },
    });
    const expectedPage = Math.floor(rank / pageSize) + 1;

    const res = await request(app.getHttpServer())
      .get(`/v1/categories/${category.id}/page`)
      .query({ pageSize })
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(res.body.page).toBe(expectedPage);
  });

  it('GET /v1/tags/:id/page liefert dieselbe Seite wie eine direkt berechnete Rangabfrage', async () => {
    const pageSize = 20;
    const tag = await prisma.tag.findFirstOrThrow({
      where: { name: { startsWith: token } },
    });
    const rank = await prisma.tag.count({ where: { name: { lt: tag.name } } });
    const expectedPage = Math.floor(rank / pageSize) + 1;

    const res = await request(app.getHttpServer())
      .get(`/v1/tags/${tag.id}/page`)
      .query({ pageSize })
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(res.body.page).toBe(expectedPage);
  });

  it('GET /v1/roles/:id/page liefert dieselbe Seite wie eine direkt berechnete Rangabfrage', async () => {
    const pageSize = 20;
    const role = await prisma.role.findFirstOrThrow({
      where: { name: { startsWith: token } },
    });
    const rank = await prisma.role.count({ where: { name: { lt: role.name } } });
    const expectedPage = Math.floor(rank / pageSize) + 1;

    const res = await request(app.getHttpServer())
      .get(`/v1/roles/${role.id}/page`)
      .query({ pageSize })
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(res.body.page).toBe(expectedPage);
  });

  it('GET /v1/media/:id/page liefert dieselbe Seite wie eine direkt berechnete Rangabfrage und die eigene folderId', async () => {
    const pageSize = 20;
    const media = await prisma.media.findFirstOrThrow({
      where: { filename: { startsWith: token } },
    });
    const rank = await prisma.media.count({
      where: { folderId: media.folderId, createdAt: { gt: media.createdAt } },
    });
    const expectedPage = Math.floor(rank / pageSize) + 1;

    const res = await request(app.getHttpServer())
      .get(`/v1/media/${media.id}/page`)
      .query({ pageSize })
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(res.body.page).toBe(expectedPage);
    expect(res.body.folderId).toBe(media.folderId);
  });

  it('GET /v1/content/preview-links/:id/page liefert dieselbe Seite wie eine direkt berechnete Rangabfrage', async () => {
    const pageSize = 20;
    const link = await prisma.contentPreviewToken.findFirstOrThrow({
      where: { token: `${token}-preview` },
    });
    const rank = await prisma.contentPreviewToken.count({
      where: { expiresAt: { gt: new Date() }, createdAt: { gt: link.createdAt } },
    });
    const expectedPage = Math.floor(rank / pageSize) + 1;

    const res = await request(app.getHttpServer())
      .get(`/v1/content/preview-links/${link.id}/page`)
      .query({ pageSize })
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(res.body.page).toBe(expectedPage);
  });

  it('GET /v1/users/:id/page verwendet dieselbe Sortierung wie die Benutzer-Übersicht (createdAt desc, nicht lastName wie in der Suche)', async () => {
    const pageSize = 20;
    const user = await prisma.user.create({
      data: {
        email: `${token}-user@pivot.dev`,
        firstName: token,
        lastName: 'Aaa Zuerst Alphabetisch',
        userRoles: {
          create: {
            roleId: (await prisma.role.findFirstOrThrow({ where: { name: 'Administrator' } })).id,
          },
        },
        passwordHash: await argon2.hash(password),
      },
    });
    // Erwartete Seite explizit über createdAt (Listen-Sortierung)
    // berechnet, nicht über lastName (das wäre die Sortierung der
    // Suche) – der Nutzer wurde soeben erstellt, sollte also createdAt
    // desc auf Rang 0 liegen (Seite 1), unabhängig vom Namen.
    const rank = await prisma.user.count({
      where: { createdAt: { gt: user.createdAt } },
    });
    const expectedPage = Math.floor(rank / pageSize) + 1;

    const res = await request(app.getHttpServer())
      .get(`/v1/users/${user.id}/page`)
      .query({ pageSize })
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(res.body.page).toBe(expectedPage);
    expect(expectedPage).toBe(1);
  });
});
