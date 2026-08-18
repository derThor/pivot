import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import * as argon2 from 'argon2';
import { PrismaService } from '../src/prisma/prisma.service';
import { createTestApp } from './setup-app';

describe('Content-Locking (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let holderToken: string;
  let otherToken: string;
  let adminToken: string;
  let contentId: string;

  const password = 'ChangeMe123!';
  const holderEmail = 'e2e-lock-holder@pivot.dev';
  const otherEmail = 'e2e-lock-other@pivot.dev';
  const adminEmail = 'e2e-lock-admin@pivot.dev';
  const contentTypeSlug = 'e2e-lock-type';

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
      where: { email: { in: [holderEmail, otherEmail, adminEmail] } },
    });
  }

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    await cleanup();

    // "Autor"-Rolle hat content:update, aber bewusst kein content:delete –
    // damit lässt sich "Sperre aufheben nur mit content:delete" sauber
    // testen, ohne die Admin-Rolle für den Holder/Other-Fall zu missbrauchen.
    const autorRole = await prisma.role.findFirstOrThrow({
      where: { name: 'Autor' },
    });
    const adminRole = await prisma.role.findFirstOrThrow({
      where: { name: 'Administrator' },
    });

    const lockUserPasswordHash = await argon2.hash(password);
    await Promise.all([
      prisma.user.create({
        data: {
          email: holderEmail,
          lastName: 'E2E Lock Holder',
          userRoles: { create: { roleId: autorRole.id } },
          passwordHash: lockUserPasswordHash,
        },
      }),
      prisma.user.create({
        data: {
          email: otherEmail,
          lastName: 'E2E Lock Other',
          userRoles: { create: { roleId: autorRole.id } },
          passwordHash: lockUserPasswordHash,
        },
      }),
      prisma.user.create({
        data: {
          email: adminEmail,
          lastName: 'E2E Lock Admin',
          userRoles: { create: { roleId: adminRole.id } },
          passwordHash: lockUserPasswordHash,
        },
      }),
    ]);

    const contentType = await prisma.contentType.create({
      data: {
        name: 'E2E Lock Type',
        slug: contentTypeSlug,
        schema: { fields: [] },
      },
    });
    const holderUser = await prisma.user.findUniqueOrThrow({
      where: { email: holderEmail },
    });
    const content = await prisma.content.create({
      data: {
        title: 'E2E Lock Content',
        slug: 'e2e-lock-content',
        contentTypeId: contentType.id,
        authorId: holderUser.id,
        data: {},
      },
    });
    contentId = content.id;

    const holderLogin = await request(app.getHttpServer())
      .post('/v1/auth/login')
      .send({ email: holderEmail, password })
      .expect(200);
    holderToken = holderLogin.body.accessToken;

    const otherLogin = await request(app.getHttpServer())
      .post('/v1/auth/login')
      .send({ email: otherEmail, password })
      .expect(200);
    otherToken = otherLogin.body.accessToken;

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

  it('POST /v1/content/:id/lock ohne Token liefert 401', async () => {
    await request(app.getHttpServer())
      .post(`/v1/content/${contentId}/lock`)
      .expect(401);
  });

  it('erste Person kann sich einen unbelegten Inhalt sperren', async () => {
    const res = await request(app.getHttpServer())
      .post(`/v1/content/${contentId}/lock`)
      .set('Authorization', `Bearer ${holderToken}`)
      .expect(201);

    expect(res.body.lockedBy.email ?? res.body.lockedBy.lastName).toBeDefined();
    expect(res.body.lockedAt).toBeDefined();
  });

  it('dieselbe Person kann die eigene Sperre erneut anfordern (Heartbeat)', async () => {
    await request(app.getHttpServer())
      .post(`/v1/content/${contentId}/lock`)
      .set('Authorization', `Bearer ${holderToken}`)
      .expect(201);
  });

  it('eine zweite Person bekommt 409 mit Info, wer gerade sperrt', async () => {
    const res = await request(app.getHttpServer())
      .post(`/v1/content/${contentId}/lock`)
      .set('Authorization', `Bearer ${otherToken}`)
      .expect(409);

    expect(res.body.lockedBy.lastName).toBe('E2E Lock Holder');
  });

  it('die zweite Person darf die fremde Sperre nicht aufheben (403)', async () => {
    await request(app.getHttpServer())
      .post(`/v1/content/${contentId}/unlock`)
      .set('Authorization', `Bearer ${otherToken}`)
      .expect(403);
  });

  it('ein Admin (content:delete) kann die fremde Sperre erzwungen aufheben', async () => {
    await request(app.getHttpServer())
      .post(`/v1/content/${contentId}/unlock`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(201);

    // Danach kann die zweite Person den jetzt freien Inhalt sperren.
    await request(app.getHttpServer())
      .post(`/v1/content/${contentId}/lock`)
      .set('Authorization', `Bearer ${otherToken}`)
      .expect(201);

    // Aufräumen für die folgenden Tests.
    await request(app.getHttpServer())
      .post(`/v1/content/${contentId}/unlock`)
      .set('Authorization', `Bearer ${otherToken}`)
      .expect(201);
  });

  it('eine abgelaufene Sperre (älter als TTL) kann von jedem übernommen werden', async () => {
    await request(app.getHttpServer())
      .post(`/v1/content/${contentId}/lock`)
      .set('Authorization', `Bearer ${holderToken}`)
      .expect(201);

    // Sperre künstlich auf "vor 3 Minuten" zurückdatieren (TTL ist 2 Minuten).
    await prisma.content.update({
      where: { id: contentId },
      data: { lockedAt: new Date(Date.now() - 3 * 60 * 1000) },
    });

    await request(app.getHttpServer())
      .post(`/v1/content/${contentId}/lock`)
      .set('Authorization', `Bearer ${otherToken}`)
      .expect(201);
  });

  it('der Inhaber kann seine eigene Sperre normal aufheben', async () => {
    // "otherToken" hält die Sperre aus dem vorigen Test.
    await request(app.getHttpServer())
      .post(`/v1/content/${contentId}/unlock`)
      .set('Authorization', `Bearer ${otherToken}`)
      .expect(201);

    const content = await prisma.content.findUniqueOrThrow({
      where: { id: contentId },
    });
    expect(content.lockedById).toBeNull();
    expect(content.lockedAt).toBeNull();
  });
});
