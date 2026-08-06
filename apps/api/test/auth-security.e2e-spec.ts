import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import * as argon2 from 'argon2';
import { PrismaService } from '../src/prisma/prisma.service';
import { createTestApp } from './setup-app';

describe('Auth-Härtung (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const password = 'Sicher123!';

  async function cleanupUsers(...emails: string[]) {
    await prisma.user.deleteMany({ where: { email: { in: emails } } });
  }

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await app.close();
  });

  function login(email: string, pw: string) {
    return request(app.getHttpServer())
      .post('/v1/auth/login')
      .send({ email, password: pw });
  }

  describe('Passwort-Policy', () => {
    const email = 'e2e-policy-test@strasev.dev';

    beforeAll(() => cleanupUsers(email));
    afterAll(() => cleanupUsers(email));

    it('lehnt Registrierung mit zu schwachem Passwort ab', async () => {
      const res = await request(app.getHttpServer())
        .post('/v1/auth/register')
        .send({ email, password: 'schwach', lastName: 'Policy Test' })
        .expect(400);

      expect(res.body.message).toMatch(/Zeichen|Großbuchstabe|Ziffer|Sonderzeichen/);
    });

    it('akzeptiert Registrierung mit konformem Passwort und liefert Dev-Verifikationslink', async () => {
      const res = await request(app.getHttpServer())
        .post('/v1/auth/register')
        .send({ email, password, lastName: 'Policy Test' })
        .expect(201);

      expect(res.body).toHaveProperty('accessToken');
      expect(res.body.verificationLinkDevOnly).toContain('/verify-email?token=');
    });
  });

  describe('Passwort ändern', () => {
    const email = 'e2e-changepw-test@strasev.dev';
    let accessToken: string;
    let firstRefreshToken: string;

    beforeAll(async () => {
      await cleanupUsers(email);
      const register = await request(app.getHttpServer())
        .post('/v1/auth/register')
        .send({ email, password, lastName: 'ChangePW Test' })
        .expect(201);
      accessToken = register.body.accessToken;
      firstRefreshToken = register.body.refreshToken;
    });

    afterAll(() => cleanupUsers(email));

    it('lehnt Änderung mit falschem aktuellem Passwort ab', async () => {
      await request(app.getHttpServer())
        .patch('/v1/auth/password')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ currentPassword: 'falsch', newPassword: 'NeuesPass123!' })
        .expect(401);
    });

    it('ändert das Passwort und widerruft bestehende Refresh-Tokens', async () => {
      await request(app.getHttpServer())
        .patch('/v1/auth/password')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ currentPassword: password, newPassword: 'NeuesPass123!' })
        .expect(200);

      // Altes Refresh-Token (aus der Registrierung) darf nicht mehr funktionieren.
      await request(app.getHttpServer())
        .post('/v1/auth/refresh')
        .send({ refreshToken: firstRefreshToken })
        .expect(401);

      // Login mit dem neuen Passwort funktioniert.
      await login(email, 'NeuesPass123!').expect(200);
      // Login mit dem alten Passwort schlägt fehl.
      await login(email, password).expect(401);
    });
  });

  describe('E-Mail-Verifikation', () => {
    const email = 'e2e-verify-test@strasev.dev';

    beforeAll(() => cleanupUsers(email));
    afterAll(() => cleanupUsers(email));

    it('verifiziert die E-Mail-Adresse über den Dev-Link-Token', async () => {
      const register = await request(app.getHttpServer())
        .post('/v1/auth/register')
        .send({ email, password, lastName: 'Verify Test' })
        .expect(201);

      const token = new URL(
        register.body.verificationLinkDevOnly,
      ).searchParams.get('token')!;

      await request(app.getHttpServer())
        .get(`/v1/auth/verify-email?token=${token}`)
        .expect(200);

      const user = await prisma.user.findUniqueOrThrow({ where: { email } });
      expect(user.emailVerifiedAt).not.toBeNull();

      // Derselbe Token darf kein zweites Mal funktionieren.
      await request(app.getHttpServer())
        .get(`/v1/auth/verify-email?token=${token}`)
        .expect(400);
    });
  });

  describe('Passwort vergessen / zurücksetzen', () => {
    const email = 'e2e-forgot-test@strasev.dev';

    beforeAll(async () => {
      await cleanupUsers(email);
      await request(app.getHttpServer())
        .post('/v1/auth/register')
        .send({ email, password, lastName: 'Forgot Test' })
        .expect(201);
    });

    afterAll(() => cleanupUsers(email));

    it('liefert für unbekannte E-Mail dieselbe generische Antwort (kein User-Enumeration-Leck)', async () => {
      const res = await request(app.getHttpServer())
        .post('/v1/auth/forgot-password')
        .send({ email: 'unbekannt@strasev.dev' })
        .expect(200);

      expect(res.body).not.toHaveProperty('resetLinkDevOnly');
    });

    it('setzt das Passwort über den Dev-Link-Token zurück', async () => {
      const forgot = await request(app.getHttpServer())
        .post('/v1/auth/forgot-password')
        .send({ email })
        .expect(200);

      const token = new URL(forgot.body.resetLinkDevOnly).searchParams.get(
        'token',
      )!;

      await request(app.getHttpServer())
        .post('/v1/auth/reset-password')
        .send({ token, newPassword: 'ZurueckgesetzT123!' })
        .expect(200);

      await login(email, 'ZurueckgesetzT123!').expect(200);
      await login(email, password).expect(401);

      // Token ist nach Nutzung verbraucht.
      await request(app.getHttpServer())
        .post('/v1/auth/reset-password')
        .send({ token, newPassword: 'NochEinPass123!' })
        .expect(400);
    });
  });

  describe('Granulare Rechte (custom Rolle)', () => {
    const email = 'e2e-permission-test@strasev.dev';
    let roleId: string;
    let accessToken: string;

    beforeAll(async () => {
      await cleanupUsers(email);
      await prisma.role.deleteMany({ where: { name: 'E2E Nur-Content-Rolle' } });

      const permission = await prisma.permission.findUniqueOrThrow({
        where: { resource_action: { resource: 'content', action: 'create' } },
      });
      const role = await prisma.role.create({
        data: {
          name: 'E2E Nur-Content-Rolle',
          permissions: { create: [{ permissionId: permission.id }] },
        },
      });
      roleId = role.id;

      await prisma.user.create({
        data: {
          email,
          lastName: 'Permission Test',
          roleId,
          passwordHash: await argon2.hash(password),
          emailVerifiedAt: new Date(),
        },
      });

      const login = await request(app.getHttpServer())
        .post('/v1/auth/login')
        .send({ email, password })
        .expect(200);
      accessToken = login.body.accessToken;
    });

    afterAll(async () => {
      const user = await prisma.user.findUnique({ where: { email } });
      if (user) {
        await prisma.content.deleteMany({ where: { authorId: user.id } });
      }
      await cleanupUsers(email);
      await prisma.role.deleteMany({ where: { id: roleId } });
    });

    it('erlaubt die zugewiesene Aktion (content:create)', async () => {
      const contentType = await prisma.contentType.findFirstOrThrow();
      await request(app.getHttpServer())
        .post('/v1/content')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          title: 'E2E Permission Test',
          slug: `e2e-permission-test-${Date.now()}`,
          contentTypeId: contentType.id,
          data: {},
        })
        .expect(201);
    });

    it('verweigert nicht zugewiesene Aktionen (media:create, users:manage)', async () => {
      await request(app.getHttpServer())
        .post('/v1/media')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(403);

      await request(app.getHttpServer())
        .get('/v1/users')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(403);
    });

    it('kann eine Rolle mit zugewiesenem User nicht löschen', async () => {
      const adminLogin = await request(app.getHttpServer())
        .post('/v1/auth/login')
        .send({ email: 'admin@strasev.dev', password: 'ChangeMe123!' })
        .expect(200);

      await request(app.getHttpServer())
        .delete(`/v1/roles/${roleId}`)
        .set('Authorization', `Bearer ${adminLogin.body.accessToken}`)
        .expect(400);
    });
  });

  describe('Settings', () => {
    it('nicht-Admin bekommt 403 auf GET /settings', async () => {
      const settings = await prisma.appSettings.findFirstOrThrow();
      expect(settings).toBeDefined();

      const email = 'e2e-settings-noauth@strasev.dev';
      await cleanupUsers(email);
      const register = await request(app.getHttpServer())
        .post('/v1/auth/register')
        .send({ email, password, lastName: 'Settings Test' })
        .expect(201);

      await request(app.getHttpServer())
        .get('/v1/settings')
        .set('Authorization', `Bearer ${register.body.accessToken}`)
        .expect(403);

      await cleanupUsers(email);
    });

    it('GET /settings/public ist ohne Auth erreichbar', async () => {
      const res = await request(app.getHttpServer())
        .get('/v1/settings/public')
        .expect(200);
      expect(res.body).toHaveProperty('allowRegistration');
      expect(res.body).not.toHaveProperty('passwordMinLength', undefined);
    });

    it('Logo- und Firmenangaben werden gespeichert und sind über /settings/public sichtbar', async () => {
      const adminLogin = await request(app.getHttpServer())
        .post('/v1/auth/login')
        .send({ email: 'admin@strasev.dev', password: 'ChangeMe123!' })
        .expect(200);
      const adminToken = adminLogin.body.accessToken as string;

      await request(app.getHttpServer())
        .patch('/v1/settings')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          logoExpandedUrl: '/uploads/e2e-logo-expanded.png',
          logoCollapsedUrl: '/uploads/e2e-logo-collapsed.png',
          companyName: 'E2E Test GmbH',
          companyStreet: 'Teststraße 1',
          companyPostalCode: '12345',
          companyCity: 'Teststadt',
          companyCountry: 'Deutschland',
        })
        .expect(200);

      const res = await request(app.getHttpServer())
        .get('/v1/settings/public')
        .expect(200);
      expect(res.body.logoExpandedUrl).toBe('/uploads/e2e-logo-expanded.png');
      expect(res.body.logoCollapsedUrl).toBe('/uploads/e2e-logo-collapsed.png');
      expect(res.body.companyName).toBe('E2E Test GmbH');
      expect(res.body.companyCity).toBe('Teststadt');

      // Aufräumen, damit andere Tests/der Dev-Stand nicht verschmutzt werden.
      await request(app.getHttpServer())
        .patch('/v1/settings')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          logoExpandedUrl: '',
          logoCollapsedUrl: '',
          companyName: '',
          companyStreet: '',
          companyPostalCode: '',
          companyCity: '',
          companyCountry: '',
        })
        .expect(200);
    });

    it('autosaveEnabled ist per Default true und über /settings/public umschaltbar', async () => {
      const adminLogin = await request(app.getHttpServer())
        .post('/v1/auth/login')
        .send({ email: 'admin@strasev.dev', password: 'ChangeMe123!' })
        .expect(200);
      const adminToken = adminLogin.body.accessToken as string;

      const defaultRes = await request(app.getHttpServer())
        .get('/v1/settings/public')
        .expect(200);
      expect(defaultRes.body.autosaveEnabled).toBe(true);

      await request(app.getHttpServer())
        .patch('/v1/settings')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ autosaveEnabled: false })
        .expect(200);

      const disabledRes = await request(app.getHttpServer())
        .get('/v1/settings/public')
        .expect(200);
      expect(disabledRes.body.autosaveEnabled).toBe(false);

      // Aufräumen, damit andere Tests/der Dev-Stand nicht verschmutzt werden.
      await request(app.getHttpServer())
        .patch('/v1/settings')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ autosaveEnabled: true })
        .expect(200);
    });
  });

  describe('Pagination (Users/Roles)', () => {
    const emails = [
      'e2e-pagination-user-1@strasev.dev',
      'e2e-pagination-user-2@strasev.dev',
    ];
    let adminAccessToken: string;
    let roleId: string;

    beforeAll(async () => {
      await cleanupUsers(...emails);
      await prisma.role.deleteMany({ where: { name: 'E2E Pagination-Rolle' } });

      const adminLogin = await request(app.getHttpServer())
        .post('/v1/auth/login')
        .send({ email: 'admin@strasev.dev', password: 'ChangeMe123!' })
        .expect(200);
      adminAccessToken = adminLogin.body.accessToken;

      const editorRole = await prisma.role.findFirstOrThrow({
        where: { name: 'Editor' },
      });
      for (const email of emails) {
        await prisma.user.create({
          data: {
            email,
            lastName: 'Pagination Test',
            roleId: editorRole.id,
            passwordHash: await argon2.hash(password),
          },
        });
      }

      const role = await prisma.role.create({
        data: { name: 'E2E Pagination-Rolle' },
      });
      roleId = role.id;
    });

    afterAll(async () => {
      await cleanupUsers(...emails);
      await prisma.role.deleteMany({ where: { id: roleId } });
    });

    it('GET /v1/users liefert paginierte Meta-Daten', async () => {
      const res = await request(app.getHttpServer())
        .get('/v1/users?page=1&pageSize=1')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .expect(200);

      expect(res.body.items).toHaveLength(1);
      expect(res.body.meta).toMatchObject({ page: 1, pageSize: 1 });
      expect(res.body.meta.total).toBeGreaterThanOrEqual(2);

      const page2 = await request(app.getHttpServer())
        .get('/v1/users?page=2&pageSize=1')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .expect(200);
      expect(page2.body.items[0].id).not.toBe(res.body.items[0].id);
    });

    it('GET /v1/roles liefert paginierte Meta-Daten', async () => {
      const res = await request(app.getHttpServer())
        .get('/v1/roles?page=1&pageSize=1')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .expect(200);

      expect(res.body.items).toHaveLength(1);
      expect(res.body.meta).toMatchObject({ page: 1, pageSize: 1 });
      expect(res.body.meta.total).toBeGreaterThanOrEqual(2);

      const page2 = await request(app.getHttpServer())
        .get('/v1/roles?page=2&pageSize=1')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .expect(200);
      expect(page2.body.items[0].id).not.toBe(res.body.items[0].id);
    });
  });

  describe('Admin-Freischaltung (requireAdminActivation)', () => {
    const email = 'e2e-activation-test@strasev.dev';
    let adminAccessToken: string;

    async function loginAdmin() {
      const res = await request(app.getHttpServer())
        .post('/v1/auth/login')
        .send({ email: 'admin@strasev.dev', password: 'ChangeMe123!' })
        .expect(200);
      return res.body.accessToken as string;
    }

    beforeAll(async () => {
      await cleanupUsers(email);
      adminAccessToken = await loginAdmin();
      await request(app.getHttpServer())
        .patch('/v1/settings')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send({ requireAdminActivation: true })
        .expect(200);
    });

    afterAll(async () => {
      await request(app.getHttpServer())
        .patch('/v1/settings')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send({ requireAdminActivation: false })
        .expect(200);
      await cleanupUsers(email);
    });

    it('legt neu registrierte Benutzer inaktiv an und meldet sie nicht automatisch an', async () => {
      const res = await request(app.getHttpServer())
        .post('/v1/auth/register')
        .send({ email, password, lastName: 'Activation Test' })
        .expect(201);

      expect(res.body.pendingActivation).toBe(true);
      expect(res.body).not.toHaveProperty('accessToken');

      const user = await prisma.user.findUniqueOrThrow({ where: { email } });
      expect(user.isActive).toBe(false);
    });

    it('lehnt Login vor Freischaltung ab und erlaubt ihn danach', async () => {
      await login(email, password).expect(401);

      const user = await prisma.user.findUniqueOrThrow({ where: { email } });
      await request(app.getHttpServer())
        .patch(`/v1/users/${user.id}`)
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send({ isActive: true })
        .expect(200);

      await login(email, password).expect(200);
    });
  });
});
