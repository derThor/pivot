import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import * as argon2 from 'argon2';
import { PrismaService } from '../src/prisma/prisma.service';
import { createTestApp } from './setup-app';

describe('Content-Papierkorb (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let accessToken: string;

  const userEmail = 'e2e-content-trash-test@pivot.dev';
  const password = 'ChangeMe123!';
  const contentTypeSlug = 'e2e-trash-test-type';

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

    const adminRole = await prisma.role.findFirstOrThrow({
      where: { name: 'Administrator' },
    });
    await prisma.user.create({
      data: {
        email: userEmail,
        lastName: 'E2E Content Trash Test',
        userRoles: { create: { roleId: adminRole.id } },
        passwordHash: await argon2.hash(password),
      },
    });
    await prisma.contentType.create({
      data: {
        name: 'E2E Trash Test Type',
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

  let createdId: string;

  it('legt einen Content-Eintrag an', async () => {
    const contentType = await prisma.contentType.findUniqueOrThrow({
      where: { slug: contentTypeSlug },
    });
    const res = await request(app.getHttpServer())
      .post('/v1/content')
      .set(auth())
      .send({
        title: 'Papierkorb-Test',
        slug: 'e2e-papierkorb-test',
        contentTypeId: contentType.id,
        data: { body: 'Hallo Welt' },
      })
      .expect(201);
    createdId = res.body.id;
  });

  it('DELETE verschiebt in den Papierkorb statt hart zu löschen', async () => {
    await request(app.getHttpServer())
      .delete(`/v1/content/${createdId}`)
      .set(auth())
      .expect(200);

    const row = await prisma.content.findUnique({ where: { id: createdId } });
    expect(row).not.toBeNull();
    expect(row?.deletedAt).not.toBeNull();
  });

  it('GET /v1/content liefert Papierkorb-Einträge nicht mehr', async () => {
    const res = await request(app.getHttpServer())
      .get('/v1/content')
      .set(auth())
      .expect(200);
    const entry = res.body.items.find(
      (item: { id: string }) => item.id === createdId,
    );
    expect(entry).toBeUndefined();
  });

  it('GET /v1/content/:id liefert 404 für Papierkorb-Einträge', async () => {
    await request(app.getHttpServer())
      .get(`/v1/content/${createdId}`)
      .set(auth())
      .expect(404);
  });

  it('GET /v1/content/search findet Papierkorb-Einträge nicht', async () => {
    const res = await request(app.getHttpServer())
      .get('/v1/content/search')
      .query({ q: 'Papierkorb-Test' })
      .set(auth())
      .expect(200);
    const entry = res.body.find(
      (item: { id: string }) => item.id === createdId,
    );
    expect(entry).toBeUndefined();
  });

  it('GET /v1/content/trash listet den Papierkorb-Eintrag', async () => {
    const res = await request(app.getHttpServer())
      .get('/v1/content/trash')
      .set(auth())
      .expect(200);
    const entry = res.body.items.find(
      (item: { id: string }) => item.id === createdId,
    );
    expect(entry).toBeDefined();
  });

  it('POST /v1/content/:id/restore holt den Eintrag zurück', async () => {
    await request(app.getHttpServer())
      .post(`/v1/content/${createdId}/restore`)
      .set(auth())
      .expect(201);

    const row = await prisma.content.findUnique({ where: { id: createdId } });
    expect(row?.deletedAt).toBeNull();

    await request(app.getHttpServer())
      .get(`/v1/content/${createdId}`)
      .set(auth())
      .expect(200);
  });

  it('DELETE /v1/content/:id/permanent löscht endgültig, nur wenn im Papierkorb', async () => {
    await request(app.getHttpServer())
      .delete(`/v1/content/${createdId}/permanent`)
      .set(auth())
      .expect(404);

    await request(app.getHttpServer())
      .delete(`/v1/content/${createdId}`)
      .set(auth())
      .expect(200);

    await request(app.getHttpServer())
      .delete(`/v1/content/${createdId}/permanent`)
      .set(auth())
      .expect(200);

    const row = await prisma.content.findUnique({ where: { id: createdId } });
    expect(row).toBeNull();
  });
});
