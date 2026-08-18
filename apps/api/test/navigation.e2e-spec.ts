import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import * as argon2 from 'argon2';
import { PrismaService } from '../src/prisma/prisma.service';
import { createTestApp } from './setup-app';

describe('Navigation (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let adminToken: string;
  let scopedToken: string;
  let contentId: string;

  const token = 'zzznavigationmarker';
  const adminEmail = 'e2e-navigation-admin@pivot.dev';
  const scopedEmail = 'e2e-navigation-scoped@pivot.dev';
  const scopedRoleName = 'E2E Navigation Scoped Role';
  const password = 'ChangeMe123!';
  const contentTypeSlug = 'e2e-navigation-type';
  const navSlug = `${token}-hauptnav`;

  async function cleanup() {
    await prisma.navigation.deleteMany({ where: { slug: navSlug } });
    const contentType = await prisma.contentType.findUnique({
      where: { slug: contentTypeSlug },
    });
    if (contentType) {
      await prisma.content.deleteMany({ where: { contentTypeId: contentType.id } });
      await prisma.contentType.delete({ where: { id: contentType.id } });
    }
    await prisma.user.deleteMany({ where: { email: { in: [adminEmail, scopedEmail] } } });
    await prisma.role.deleteMany({ where: { name: scopedRoleName } });
  }

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    await cleanup();

    const adminRole = await prisma.role.findFirstOrThrow({ where: { name: 'Administrator' } });
    const adminUser = await prisma.user.create({
      data: {
        email: adminEmail,
        lastName: 'E2E Navigation Admin',
        userRoles: { create: { roleId: adminRole.id } },
        passwordHash: await argon2.hash(password),
      },
    });

    // Rolle mit content:read, aber ohne settings:manage – belegt, dass
    // Navigation-Endpoints eine eigene Permission verlangen, nicht nur
    // irgendeine.
    const contentReadPermission = await prisma.permission.findUniqueOrThrow({
      where: { resource_action: { resource: 'content', action: 'read' } },
    });
    const scopedRole = await prisma.role.create({ data: { name: scopedRoleName } });
    await prisma.rolePermission.create({
      data: { roleId: scopedRole.id, permissionId: contentReadPermission.id },
    });
    await prisma.user.create({
      data: {
        email: scopedEmail,
        lastName: 'E2E Navigation Scoped',
        userRoles: { create: { roleId: scopedRole.id } },
        passwordHash: await argon2.hash(password),
      },
    });

    const contentType = await prisma.contentType.create({
      data: { name: 'E2E Navigation Type', slug: contentTypeSlug, schema: { fields: [] } },
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

  let navigationId: string;

  it('POST /v1/navigations ohne Token liefert 401', async () => {
    await request(app.getHttpServer())
      .post('/v1/navigations')
      .send({ name: 'Hauptnavigation', slug: navSlug })
      .expect(401);
  });

  it('POST /v1/navigations mit content:read (aber ohne settings:manage) liefert 403', async () => {
    await request(app.getHttpServer())
      .post('/v1/navigations')
      .set('Authorization', `Bearer ${scopedToken}`)
      .send({ name: 'Hauptnavigation', slug: navSlug })
      .expect(403);
  });

  it('POST /v1/navigations legt eine Navigation an', async () => {
    const res = await request(app.getHttpServer())
      .post('/v1/navigations')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Hauptnavigation', slug: navSlug })
      .expect(201);
    expect(res.body.id).toBeDefined();
    navigationId = res.body.id;
  });

  it('POST /v1/navigations mit bereits vergebenem Slug liefert 409', async () => {
    await request(app.getHttpServer())
      .post('/v1/navigations')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Andere Navigation', slug: navSlug })
      .expect(409);
  });

  it('POST /v1/navigations/:id/items ohne Ziel (weder contentId noch externalUrl) liefert 400', async () => {
    await request(app.getHttpServer())
      .post(`/v1/navigations/${navigationId}/items`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ label: 'Ohne Ziel' })
      .expect(400);
  });

  it('POST /v1/navigations/:id/items mit BEIDEN Zielen (contentId UND externalUrl) liefert 400', async () => {
    await request(app.getHttpServer())
      .post(`/v1/navigations/${navigationId}/items`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ label: 'Beides', contentId, externalUrl: 'https://example.com' })
      .expect(400);
  });

  let contentItemId: string;
  let externalItemId: string;

  it('POST /v1/navigations/:id/items mit contentId legt einen Eintrag an', async () => {
    const res = await request(app.getHttpServer())
      .post(`/v1/navigations/${navigationId}/items`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ label: `${token} Inhalt-Link`, contentId })
      .expect(201);
    expect(res.body.content.id).toBe(contentId);
    contentItemId = res.body.id;
  });

  it('POST /v1/navigations/:id/items mit externalUrl legt einen Eintrag an', async () => {
    const res = await request(app.getHttpServer())
      .post(`/v1/navigations/${navigationId}/items`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ label: `${token} Extern`, externalUrl: 'https://example.com' })
      .expect(201);
    expect(res.body.externalUrl).toBe('https://example.com');
    externalItemId = res.body.id;
  });

  let nestedItemId: string;

  it('POST /v1/navigations/:id/items mit parentId verschachtelt den Eintrag', async () => {
    const res = await request(app.getHttpServer())
      .post(`/v1/navigations/${navigationId}/items`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        label: `${token} Verschachtelt`,
        externalUrl: 'https://example.com/nested',
        parentId: externalItemId,
      })
      .expect(201);
    expect(res.body.parentId).toBe(externalItemId);
    nestedItemId = res.body.id;
  });

  it('GET /v1/navigations/:id liefert eine verschachtelte Baumstruktur', async () => {
    const res = await request(app.getHttpServer())
      .get(`/v1/navigations/${navigationId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    const external = res.body.items.find((i: { id: string }) => i.id === externalItemId);
    expect(external).toBeDefined();
    expect(
      external.children.some((c: { id: string }) => c.id === nestedItemId),
    ).toBe(true);
    expect(
      res.body.items.some((i: { id: string }) => i.id === contentItemId),
    ).toBe(true);
  });

  it('PATCH .../items/:itemId verhindert Zirkularität', async () => {
    // externalItemId ist Elternteil von nestedItemId – nestedItemId darf
    // also nicht zum Elternteil von externalItemId gemacht werden.
    await request(app.getHttpServer())
      .patch(`/v1/navigations/${navigationId}/items/${externalItemId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ parentId: nestedItemId })
      .expect(400);
  });

  it('PATCH .../items/reorder persistiert neue Reihenfolge/Verschachtelung', async () => {
    await request(app.getHttpServer())
      .patch(`/v1/navigations/${navigationId}/items/reorder`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        items: [
          { id: nestedItemId, parentId: null, sortOrder: 0 },
          { id: externalItemId, parentId: null, sortOrder: 1 },
          { id: contentItemId, parentId: null, sortOrder: 2 },
        ],
      })
      .expect(200);

    const item = await prisma.navigationItem.findUniqueOrThrow({
      where: { id: nestedItemId },
    });
    expect(item.parentId).toBeNull();
    expect(item.sortOrder).toBe(0);
  });

  it('DELETE .../items/:itemId entfernt einen Eintrag', async () => {
    await request(app.getHttpServer())
      .delete(`/v1/navigations/${navigationId}/items/${nestedItemId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    const res = await request(app.getHttpServer())
      .get(`/v1/navigations/${navigationId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(
      res.body.items.some((i: { id: string }) => i.id === nestedItemId),
    ).toBe(false);
  });

  it('GET /v1/navigations listet die Navigation mit Item-Anzahl', async () => {
    const res = await request(app.getHttpServer())
      .get('/v1/navigations')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    const nav = res.body.find((n: { id: string }) => n.id === navigationId);
    expect(nav).toBeDefined();
    expect(nav._count.items).toBe(2);
  });

  it('DELETE /v1/navigations/:id löscht die Navigation inkl. aller Items (Cascade)', async () => {
    await request(app.getHttpServer())
      .delete(`/v1/navigations/${navigationId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    const remainingItems = await prisma.navigationItem.count({
      where: { navigationId },
    });
    expect(remainingItems).toBe(0);
  });
});
