import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service';
import { createTestApp } from './setup-app';

describe('Auth-Flow (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const email = 'e2e-auth-test@strasev.dev';
  const password = 'ChangeMe123!';

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    // Aufräumen von einem evtl. abgebrochenen vorherigen Lauf
    await prisma.user.deleteMany({ where: { email } });
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email } });
    await app.close();
  });

  it('POST /v1/auth/register legt einen neuen Benutzer an', async () => {
    const res = await request(app.getHttpServer())
      .post('/v1/auth/register')
      .send({ email, password, lastName: 'E2E Auth Test' })
      .expect(201);

    expect(res.body).toHaveProperty('accessToken');
    expect(res.body).toHaveProperty('refreshToken');
  });

  it('POST /v1/auth/register lehnt doppelte E-Mail ab', async () => {
    await request(app.getHttpServer())
      .post('/v1/auth/register')
      .send({ email, password, lastName: 'E2E Auth Test' })
      .expect(409);
  });

  it('POST /v1/auth/login mit falschem Passwort schlägt fehl', async () => {
    await request(app.getHttpServer())
      .post('/v1/auth/login')
      .send({ email, password: 'FalschesPasswort123!' })
      .expect(401);
  });

  it('POST /v1/auth/login mit korrekten Zugangsdaten liefert Token-Paar', async () => {
    const res = await request(app.getHttpServer())
      .post('/v1/auth/login')
      .send({ email, password })
      .expect(200);

    expect(res.body).toHaveProperty('accessToken');
    expect(res.body).toHaveProperty('refreshToken');
  });

  it('GET /v1/auth/me ohne Token liefert 401', async () => {
    await request(app.getHttpServer()).get('/v1/auth/me').expect(401);
  });

  it('GET /v1/auth/me mit gültigem Token liefert das eigene Profil', async () => {
    const login = await request(app.getHttpServer())
      .post('/v1/auth/login')
      .send({ email, password })
      .expect(200);

    const res = await request(app.getHttpServer())
      .get('/v1/auth/me')
      .set('Authorization', `Bearer ${login.body.accessToken}`)
      .expect(200);

    expect(res.body.email).toBe(email);
    expect(res.body).not.toHaveProperty('passwordHash');
  });

  it('nicht-ADMIN erhält 403 auf ADMIN-geschützte Route', async () => {
    const login = await request(app.getHttpServer())
      .post('/v1/auth/login')
      .send({ email, password })
      .expect(200);

    // Neu registrierte Nutzer bekommen die per isDefault=true markierte Rolle ("Autor")
    await request(app.getHttpServer())
      .get('/v1/users')
      .set('Authorization', `Bearer ${login.body.accessToken}`)
      .expect(403);
  });

  it('Refresh-Token-Rotation: altes Token nach Refresh ungültig', async () => {
    const login = await request(app.getHttpServer())
      .post('/v1/auth/login')
      .send({ email, password })
      .expect(200);
    const oldRefreshToken = login.body.refreshToken;

    const refreshed = await request(app.getHttpServer())
      .post('/v1/auth/refresh')
      .send({ refreshToken: oldRefreshToken })
      .expect(200);

    expect(refreshed.body.refreshToken).not.toBe(oldRefreshToken);

    await request(app.getHttpServer())
      .post('/v1/auth/refresh')
      .send({ refreshToken: oldRefreshToken })
      .expect(401);
  });

  it('Logout widerruft das Refresh-Token', async () => {
    const login = await request(app.getHttpServer())
      .post('/v1/auth/login')
      .send({ email, password })
      .expect(200);

    await request(app.getHttpServer())
      .post('/v1/auth/logout')
      .send({ refreshToken: login.body.refreshToken })
      .expect(204);

    await request(app.getHttpServer())
      .post('/v1/auth/refresh')
      .send({ refreshToken: login.body.refreshToken })
      .expect(401);
  });
});
