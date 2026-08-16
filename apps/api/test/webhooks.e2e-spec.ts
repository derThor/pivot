import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import * as argon2 from 'argon2';
import { PrismaService } from '../src/prisma/prisma.service';
import { WebhooksService } from '../src/webhooks/webhooks.service';
import { createTestApp } from './setup-app';

describe('Webhooks (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let adminToken: string;
  let scopedToken: string;

  const password = 'ChangeMe123!';
  const adminEmail = 'e2e-webhooks-admin@pivot.dev';
  const scopedEmail = 'e2e-webhooks-scoped@pivot.dev';
  const scopedRoleName = 'E2E Webhooks Scoped Role';
  const testUrl = 'http://127.0.0.1:9/e2e-webhook-does-not-exist';

  async function cleanup() {
    await prisma.webhook.deleteMany({ where: { url: testUrl } });
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
        lastName: 'E2E Webhooks Admin',
        userRoles: { create: { roleId: adminRole.id } },
        passwordHash: await argon2.hash(password),
      },
    });

    // Rolle ohne settings:manage – belegt, dass Webhook-Endpoints wie der
    // Rest von /settings geschützt sind, nicht öffentlich für jeden
    // eingeloggten Nutzer.
    const scopedRole = await prisma.role.create({ data: { name: scopedRoleName } });
    await prisma.user.create({
      data: {
        email: scopedEmail,
        lastName: 'E2E Webhooks Scoped',
        userRoles: { create: { roleId: scopedRole.id } },
        passwordHash: await argon2.hash(password),
      },
    });

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

  it('GET /v1/webhooks ohne Token liefert 401', async () => {
    await request(app.getHttpServer()).get('/v1/webhooks').expect(401);
  });

  it('GET /v1/webhooks ohne settings:manage liefert 403', async () => {
    await request(app.getHttpServer())
      .get('/v1/webhooks')
      .set('Authorization', `Bearer ${scopedToken}`)
      .expect(403);
  });

  it('POST /v1/webhooks lehnt ungültige Events ab (400)', async () => {
    await request(app.getHttpServer())
      .post('/v1/webhooks')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ url: testUrl, events: ['not-a-real-event'] })
      .expect(400);
  });

  it('POST /v1/webhooks lehnt leere Event-Liste ab (400)', async () => {
    await request(app.getHttpServer())
      .post('/v1/webhooks')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ url: testUrl, events: [] })
      .expect(400);
  });

  let webhookId: string;

  it('POST /v1/webhooks legt einen Webhook an', async () => {
    const res = await request(app.getHttpServer())
      .post('/v1/webhooks')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ url: testUrl, events: ['content.published', 'content.updated'] })
      .expect(201);

    expect(res.body.isActive).toBe(true);
    expect(res.body.events).toEqual(['content.published', 'content.updated']);
    webhookId = res.body.id;
  });

  it('GET /v1/webhooks listet den angelegten Webhook', async () => {
    const res = await request(app.getHttpServer())
      .get('/v1/webhooks')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(res.body.items.some((w: { id: string }) => w.id === webhookId)).toBe(
      true,
    );
  });

  it('dispatch() wirft nie, selbst wenn die Ziel-URL nicht erreichbar ist (fire-and-forget)', async () => {
    // Webhook aus dem vorigen Test ist noch aktiv – dispatch() versucht
    // hier also wirklich, an die (absichtlich unerreichbare) testUrl
    // zuzustellen. Die Zusicherung: ein nicht erreichbarer Endpoint
    // (127.0.0.1:9 verweigert Verbindungen) darf den aufrufenden
    // Content-Vorgang niemals zum Absturz bringen – siehe
    // `WebhooksService.deliver()`.
    const webhooksService = app.get(WebhooksService);
    await expect(
      webhooksService.dispatch('content.published', { id: 'irrelevant' }),
    ).resolves.not.toThrow();
  });

  it('PATCH /v1/webhooks/:id deaktiviert den Webhook', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/v1/webhooks/${webhookId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ isActive: false })
      .expect(200);

    expect(res.body.isActive).toBe(false);
  });

  it('DELETE /v1/webhooks/:id entfernt den Webhook', async () => {
    await request(app.getHttpServer())
      .delete(`/v1/webhooks/${webhookId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    const res = await request(app.getHttpServer())
      .get('/v1/webhooks')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(res.body.items.some((w: { id: string }) => w.id === webhookId)).toBe(
      false,
    );
  });
});
