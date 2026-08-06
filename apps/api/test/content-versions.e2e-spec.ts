import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import * as argon2 from 'argon2';
import { PrismaService } from '../src/prisma/prisma.service';
import { createTestApp } from './setup-app';

describe('Content-Versionierung & Rollback (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let accessToken: string;
  let contentId: string;
  let contentTypeId: string;

  const userEmail = 'e2e-content-versions-test@strasev.dev';
  const password = 'ChangeMe123!';
  const contentTypeSlug = 'e2e-content-versions-type';

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
      where: { name: 'Admin' },
    });
    await prisma.user.create({
      data: {
        email: userEmail,
        lastName: 'E2E Content Versions Test',
        roleId: adminRole.id,
        passwordHash: await argon2.hash(password),
      },
    });
    const contentType = await prisma.contentType.create({
      data: {
        name: 'E2E Content Versions Type',
        slug: contentTypeSlug,
        schema: { fields: [{ name: 'body', type: 'string', required: true }] },
      },
    });
    contentTypeId = contentType.id;

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

  it('legt Content an und ändert ihn zweimal (erzeugt zwei Versionen)', async () => {
    const created = await request(app.getHttpServer())
      .post('/v1/content')
      .set(auth())
      .send({
        title: 'E2E Versions Test',
        slug: 'e2e-versions-test',
        contentTypeId,
        data: { body: 'Stand 1' },
      })
      .expect(201);
    contentId = created.body.id;

    await request(app.getHttpServer())
      .patch(`/v1/content/${contentId}`)
      .set(auth())
      .send({ data: { body: 'Stand 2' } })
      .expect(200);

    await request(app.getHttpServer())
      .patch(`/v1/content/${contentId}`)
      .set(auth())
      .send({ data: { body: 'Stand 3 (aktuell)' } })
      .expect(200);
  });

  it('GET /v1/content/:id/versions liefert die Historie paginiert', async () => {
    const res = await request(app.getHttpServer())
      .get(`/v1/content/${contentId}/versions`)
      .set(auth())
      .expect(200);

    expect(res.body.items).toHaveLength(2);
    expect(res.body.meta.total).toBe(2);
    // Neueste zuerst
    expect(res.body.items[0].data.body).toBe('Stand 2');
    expect(res.body.items[1].data.body).toBe('Stand 1');
    expect(res.body.items[0].createdBy).toHaveProperty('lastName');
  });

  it('POST rollback stellt den historischen Stand wieder her und legt eine neue Version an', async () => {
    const versions = await request(app.getHttpServer())
      .get(`/v1/content/${contentId}/versions`)
      .set(auth())
      .expect(200);
    const oldestVersionId = versions.body.items[1].id; // "Stand 1"

    await request(app.getHttpServer())
      .post(`/v1/content/${contentId}/versions/${oldestVersionId}/rollback`)
      .set(auth())
      .expect(201);

    const afterRollback = await request(app.getHttpServer())
      .get(`/v1/content/${contentId}`)
      .set(auth())
      .expect(200);
    expect(afterRollback.body.data.body).toBe('Stand 1');

    const versionsAfter = await request(app.getHttpServer())
      .get(`/v1/content/${contentId}/versions`)
      .set(auth())
      .expect(200);
    // Der überschriebene Stand ("Stand 3 (aktuell)") wurde vor dem
    // Rollback selbst als neue Version gesichert.
    expect(versionsAfter.body.meta.total).toBe(3);
    expect(versionsAfter.body.items[0].data.body).toBe('Stand 3 (aktuell)');
  });

  it('lehnt Rollback mit versionId eines fremden Contents ab (404)', async () => {
    const otherContent = await request(app.getHttpServer())
      .post('/v1/content')
      .set(auth())
      .send({
        title: 'E2E Versions Test – Anderer Content',
        slug: 'e2e-versions-test-anderer',
        contentTypeId,
        data: { body: 'Fremder Content' },
      })
      .expect(201);
    await request(app.getHttpServer())
      .patch(`/v1/content/${otherContent.body.id}`)
      .set(auth())
      .send({ data: { body: 'Fremder Content geändert' } })
      .expect(200);
    const otherVersions = await request(app.getHttpServer())
      .get(`/v1/content/${otherContent.body.id}/versions`)
      .set(auth())
      .expect(200);
    const foreignVersionId = otherVersions.body.items[0].id;

    await request(app.getHttpServer())
      .post(`/v1/content/${contentId}/versions/${foreignVersionId}/rollback`)
      .set(auth())
      .expect(404);
  });

  it('verweigert Versionshistorie/Rollback ohne content:update-Recht', async () => {
    const betrachterRole = await prisma.role.create({
      data: { name: 'E2E Versions Nur-Lesen-Rolle' },
    });
    const readPermission = await prisma.permission.findUniqueOrThrow({
      where: { resource_action: { resource: 'content', action: 'read' } },
    });
    await prisma.rolePermission.create({
      data: { roleId: betrachterRole.id, permissionId: readPermission.id },
    });
    const readerEmail = 'e2e-content-versions-reader@strasev.dev';
    await prisma.user.deleteMany({ where: { email: readerEmail } });
    await prisma.user.create({
      data: {
        email: readerEmail,
        lastName: 'E2E Versions Reader',
        roleId: betrachterRole.id,
        passwordHash: await argon2.hash(password),
      },
    });
    const readerLogin = await request(app.getHttpServer())
      .post('/v1/auth/login')
      .send({ email: readerEmail, password })
      .expect(200);
    const readerAuth = { Authorization: `Bearer ${readerLogin.body.accessToken}` };

    await request(app.getHttpServer())
      .get(`/v1/content/${contentId}/versions`)
      .set(readerAuth)
      .expect(403);

    await prisma.user.deleteMany({ where: { email: readerEmail } });
    await prisma.role.deleteMany({ where: { id: betrachterRole.id } });
  });

  it('DELETE /v1/content/:id/versions/:versionId löscht eine einzelne Version', async () => {
    const before = await request(app.getHttpServer())
      .get(`/v1/content/${contentId}/versions`)
      .set(auth())
      .expect(200);
    const totalBefore = before.body.meta.total;
    const versionToDelete = before.body.items[0].id;

    await request(app.getHttpServer())
      .delete(`/v1/content/${contentId}/versions/${versionToDelete}`)
      .set(auth())
      .expect(200);

    const after = await request(app.getHttpServer())
      .get(`/v1/content/${contentId}/versions`)
      .set(auth())
      .expect(200);
    expect(after.body.meta.total).toBe(totalBefore - 1);
    expect(
      after.body.items.some((item: { id: string }) => item.id === versionToDelete),
    ).toBe(false);

    // Der aktuelle Content-Stand bleibt unberührt – Löschen einer Version
    // wirkt sich nicht auf Content.data aus.
    const content = await request(app.getHttpServer())
      .get(`/v1/content/${contentId}`)
      .set(auth())
      .expect(200);
    expect(content.body.data.body).toBe('Stand 1');
  });

  it('lehnt DELETE einer versionId eines fremden Contents ab (404)', async () => {
    const otherContent = await request(app.getHttpServer())
      .post('/v1/content')
      .set(auth())
      .send({
        title: 'E2E Versions Test – Löschen fremd',
        slug: 'e2e-versions-test-loeschen-fremd',
        contentTypeId,
        data: { body: 'Fremder Content für Löschen-Test' },
      })
      .expect(201);
    await request(app.getHttpServer())
      .patch(`/v1/content/${otherContent.body.id}`)
      .set(auth())
      .send({ data: { body: 'Fremder Content geändert' } })
      .expect(200);
    const otherVersions = await request(app.getHttpServer())
      .get(`/v1/content/${otherContent.body.id}/versions`)
      .set(auth())
      .expect(200);
    const foreignVersionId = otherVersions.body.items[0].id;

    await request(app.getHttpServer())
      .delete(`/v1/content/${contentId}/versions/${foreignVersionId}`)
      .set(auth())
      .expect(404);
  });

  it('verweigert DELETE einer Version ohne content:update-Recht (403)', async () => {
    const readerEmail = 'e2e-content-versions-delete-reader@strasev.dev';
    const readerRole = await prisma.role.create({
      data: { name: 'E2E Versions Delete Nur-Lesen-Rolle' },
    });
    const readPermission = await prisma.permission.findUniqueOrThrow({
      where: { resource_action: { resource: 'content', action: 'read' } },
    });
    await prisma.rolePermission.create({
      data: { roleId: readerRole.id, permissionId: readPermission.id },
    });
    await prisma.user.deleteMany({ where: { email: readerEmail } });
    await prisma.user.create({
      data: {
        email: readerEmail,
        lastName: 'E2E Versions Delete Reader',
        roleId: readerRole.id,
        passwordHash: await argon2.hash(password),
      },
    });
    const readerLogin = await request(app.getHttpServer())
      .post('/v1/auth/login')
      .send({ email: readerEmail, password })
      .expect(200);

    const versions = await request(app.getHttpServer())
      .get(`/v1/content/${contentId}/versions`)
      .set(auth())
      .expect(200);
    const versionId = versions.body.items[0].id;

    await request(app.getHttpServer())
      .delete(`/v1/content/${contentId}/versions/${versionId}`)
      .set({ Authorization: `Bearer ${readerLogin.body.accessToken}` })
      .expect(403);

    await prisma.user.deleteMany({ where: { email: readerEmail } });
    await prisma.role.deleteMany({ where: { id: readerRole.id } });
  });
});
