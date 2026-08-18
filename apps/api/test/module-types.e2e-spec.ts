import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import * as argon2 from 'argon2';
import { PrismaService } from '../src/prisma/prisma.service';
import { createTestApp } from './setup-app';

describe('Modul-Typen / Seiten-Designer (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let adminToken: string;
  let contentTypeId: string;
  let richTextModuleTypeId: string;

  const password = 'ChangeMe123!';
  const adminEmail = 'e2e-module-types-admin@pivot.dev';
  const contentTypeSlug = 'e2e-module-types-type';
  const moduleTypeSlug = 'e2e-module-types-rich-text';

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
    await prisma.moduleType.deleteMany({ where: { slug: moduleTypeSlug } });
    await prisma.user.deleteMany({ where: { email: adminEmail } });
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
        lastName: 'E2E Modul-Typen Admin',
        userRoles: { create: { roleId: adminRole.id } },
        passwordHash: await argon2.hash(password),
      },
    });

    const moduleType = await prisma.moduleType.create({
      data: {
        name: 'E2E Rich-Text',
        slug: moduleTypeSlug,
        icon: 'FileText',
        schema: { fields: [{ name: 'content', type: 'richtext', required: true }] },
      },
    });
    richTextModuleTypeId = moduleType.id;

    const contentType = await prisma.contentType.create({
      data: {
        name: 'E2E Modul-Typen Content-Type',
        slug: contentTypeSlug,
        schema: {
          fields: [
            { name: 'title', type: 'string', required: true },
            { name: 'blocks', type: 'modules' },
          ],
        },
      },
    });
    contentTypeId = contentType.id;

    const adminLogin = await request(app.getHttpServer())
      .post('/v1/auth/login')
      .send({ email: adminEmail, password })
      .expect(200);
    adminToken = adminLogin.body.accessToken;
  });

  afterAll(async () => {
    await cleanup();
    await app.close();
  });

  it('GET /v1/module-types ist öffentlich (kein Token nötig) – die anonyme Vorschau-Seite muss Modul-Typen auflösen können', async () => {
    const res = await request(app.getHttpServer()).get('/v1/module-types').expect(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('GET /v1/module-types liefert den seedbaren Modul-Typ', async () => {
    const res = await request(app.getHttpServer())
      .get('/v1/module-types')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    const found = res.body.find((mt: { id: string }) => mt.id === richTextModuleTypeId);
    expect(found).toMatchObject({
      name: 'E2E Rich-Text',
      slug: moduleTypeSlug,
      icon: 'FileText',
    });
  });

  it('GET /v1/module-types/:id liefert einen einzelnen Modul-Typ', async () => {
    const res = await request(app.getHttpServer())
      .get(`/v1/module-types/${richTextModuleTypeId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(res.body.schema).toEqual({
      fields: [{ name: 'content', type: 'richtext', required: true }],
    });
  });

  it('GET /v1/module-types/:id ist ebenfalls öffentlich', async () => {
    const res = await request(app.getHttpServer())
      .get(`/v1/module-types/${richTextModuleTypeId}`)
      .expect(200);
    expect(res.body.slug).toBe(moduleTypeSlug);
  });

  it('GET /v1/module-types/:id liefert 404 für unbekannte Id', async () => {
    await request(app.getHttpServer())
      .get('/v1/module-types/garantiert-nicht-existent')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(404);
  });

  it('POST /v1/content persistiert geordnete Modul-Instanzen und gibt sie unverändert (inkl. Reihenfolge) zurück', async () => {
    const blocks = [
      {
        id: 'block-1',
        moduleTypeId: richTextModuleTypeId,
        values: { content: '<p>Hallo Baustein</p>' },
      },
      {
        id: 'block-2',
        moduleTypeId: richTextModuleTypeId,
        values: { content: '<p>Zweiter Baustein</p>' },
      },
    ];

    const createRes = await request(app.getHttpServer())
      .post('/v1/content')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: 'E2E Modul-Instanzen Content',
        slug: 'e2e-modul-instanzen-content',
        contentTypeId,
        status: 'DRAFT',
        data: { title: 'E2E Modul-Instanzen Content', blocks },
      })
      .expect(201);
    const createdId = createRes.body.id;
    expect(createRes.body.data.blocks).toEqual(blocks);

    const getRes = await request(app.getHttpServer())
      .get(`/v1/content/${createdId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(getRes.body.data.blocks).toEqual(blocks);

    await prisma.content.delete({ where: { id: createdId } });
  });
});
