import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import * as argon2 from 'argon2';
import { PrismaService } from '../src/prisma/prisma.service';
import { createTestApp } from './setup-app';

describe('Kategorien/Tags-Flow (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let accessToken: string;

  const userEmail = 'e2e-taxonomy-test@pivot.dev';
  const password = 'ChangeMe123!';

  async function cleanup() {
    await prisma.category.deleteMany({
      where: { slug: { startsWith: 'e2e-taxonomy-' } },
    });
    await prisma.tag.deleteMany({
      where: { slug: { startsWith: 'e2e-taxonomy-' } },
    });
    await prisma.user.deleteMany({ where: { email: userEmail } });
  }

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);

    await cleanup();

    const editorRole = await prisma.role.findFirstOrThrow({
      where: { name: 'Editor' },
    });
    await prisma.user.create({
      data: {
        email: userEmail,
        lastName: 'E2E Taxonomy Test',
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

  let categoryId: string;

  it('POST /v1/categories legt eine Kategorie mit Beschreibung an', async () => {
    const res = await request(app.getHttpServer())
      .post('/v1/categories')
      .set(auth())
      .send({
        name: 'E2E Taxonomy Kategorie',
        slug: 'e2e-taxonomy-kategorie',
        description: 'Ursprüngliche Beschreibung',
      })
      .expect(201);

    expect(res.body.description).toBe('Ursprüngliche Beschreibung');
    categoryId = res.body.id;
  });

  it('PATCH /v1/categories/:id ändert Name, Slug und Beschreibung', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/v1/categories/${categoryId}`)
      .set(auth())
      .send({
        name: 'E2E Taxonomy Kategorie (geändert)',
        description: 'Neue Beschreibung',
      })
      .expect(200);

    expect(res.body.name).toBe('E2E Taxonomy Kategorie (geändert)');
    expect(res.body.description).toBe('Neue Beschreibung');
    expect(res.body.slug).toBe('e2e-taxonomy-kategorie');
  });

  it('PATCH /v1/categories/:id lehnt Namenskollision mit anderer Kategorie ab', async () => {
    const other = await request(app.getHttpServer())
      .post('/v1/categories')
      .set(auth())
      .send({ name: 'E2E Taxonomy Andere', slug: 'e2e-taxonomy-andere' })
      .expect(201);

    await request(app.getHttpServer())
      .patch(`/v1/categories/${other.body.id}`)
      .set(auth())
      .send({ name: 'E2E Taxonomy Kategorie (geändert)' })
      .expect(409);
  });

  it('GET /v1/categories liefert paginierte Meta-Daten', async () => {
    const res = await request(app.getHttpServer())
      .get('/v1/categories?page=1&pageSize=1')
      .set(auth())
      .expect(200);

    expect(res.body.items).toHaveLength(1);
    expect(res.body.meta).toMatchObject({ page: 1, pageSize: 1 });
    expect(res.body.meta.total).toBeGreaterThanOrEqual(2);
    expect(res.body.meta.pageCount).toBeGreaterThanOrEqual(2);

    const page2 = await request(app.getHttpServer())
      .get('/v1/categories?page=2&pageSize=1')
      .set(auth())
      .expect(200);
    expect(page2.body.items[0].id).not.toBe(res.body.items[0].id);
  });

  let tagId: string;

  it('POST /v1/tags legt einen Tag an', async () => {
    const res = await request(app.getHttpServer())
      .post('/v1/tags')
      .set(auth())
      .send({ name: 'E2E Taxonomy Tag', slug: 'e2e-taxonomy-tag' })
      .expect(201);
    tagId = res.body.id;
  });

  it('PATCH /v1/tags/:id ändert Name und Slug', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/v1/tags/${tagId}`)
      .set(auth())
      .send({ name: 'E2E Taxonomy Tag (geändert)', slug: 'e2e-taxonomy-tag-2' })
      .expect(200);

    expect(res.body.name).toBe('E2E Taxonomy Tag (geändert)');
    expect(res.body.slug).toBe('e2e-taxonomy-tag-2');
  });

  it('GET /v1/tags liefert paginierte Meta-Daten', async () => {
    const other = await request(app.getHttpServer())
      .post('/v1/tags')
      .set(auth())
      .send({ name: 'E2E Taxonomy Tag Zwei', slug: 'e2e-taxonomy-tag-zwei' })
      .expect(201);

    const res = await request(app.getHttpServer())
      .get('/v1/tags?page=1&pageSize=1')
      .set(auth())
      .expect(200);

    expect(res.body.items).toHaveLength(1);
    expect(res.body.meta).toMatchObject({ page: 1, pageSize: 1 });
    expect(res.body.meta.total).toBeGreaterThanOrEqual(2);

    const page2 = await request(app.getHttpServer())
      .get('/v1/tags?page=2&pageSize=1')
      .set(auth())
      .expect(200);
    expect(page2.body.items[0].id).not.toBe(res.body.items[0].id);

    await request(app.getHttpServer())
      .delete(`/v1/tags/${other.body.id}`)
      .set(auth())
      .expect(200);
  });

  it('verweigert PATCH ohne categories:update/tags:update-Recht', async () => {
    const autorRole = await prisma.role.findFirstOrThrow({
      where: { name: 'Autor' },
    });
    const autorEmail = 'e2e-taxonomy-autor@pivot.dev';
    await prisma.user.deleteMany({ where: { email: autorEmail } });
    await prisma.user.create({
      data: {
        email: autorEmail,
        lastName: 'E2E Taxonomy Autor',
        roleId: autorRole.id,
        passwordHash: await argon2.hash(password),
      },
    });
    const autorLogin = await request(app.getHttpServer())
      .post('/v1/auth/login')
      .send({ email: autorEmail, password })
      .expect(200);

    await request(app.getHttpServer())
      .patch(`/v1/categories/${categoryId}`)
      .set({ Authorization: `Bearer ${autorLogin.body.accessToken}` })
      .send({ name: 'Sollte nicht klappen' })
      .expect(403);

    await prisma.user.deleteMany({ where: { email: autorEmail } });
  });
});
