import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import * as argon2 from 'argon2';
import { PrismaService } from '../src/prisma/prisma.service';
import { ContentService } from '../src/content/content.service';
import { createTestApp } from './setup-app';

describe('Content-Flow (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let accessToken: string;

  const userEmail = 'e2e-content-test@strasev.dev';
  const password = 'ChangeMe123!';
  const contentTypeSlug = 'e2e-test-type';

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
    await prisma.category.deleteMany({
      where: { slug: { startsWith: 'e2e-content-kategorie-' } },
    });
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
        lastName: 'E2E Content Test',
        roleId: adminRole.id,
        passwordHash: await argon2.hash(password),
      },
    });
    await prisma.contentType.create({
      data: {
        name: 'E2E Test Type',
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

  it('POST /v1/content ohne Token liefert 401', async () => {
    await request(app.getHttpServer())
      .post('/v1/content')
      .send({ title: 'x', slug: 'x', contentTypeId: 'irrelevant', data: {} })
      .expect(401);
  });

  let createdId: string;

  it('POST /v1/content legt einen Content-Eintrag als DRAFT an', async () => {
    const contentType = await prisma.contentType.findUniqueOrThrow({
      where: { slug: contentTypeSlug },
    });

    const res = await request(app.getHttpServer())
      .post('/v1/content')
      .set(auth())
      .send({
        title: 'E2E Testeintrag',
        slug: 'e2e-testeintrag',
        contentTypeId: contentType.id,
        data: { body: 'Hallo Welt' },
      })
      .expect(201);

    expect(res.body.status).toBe('DRAFT');
    expect(res.body.publishedAt).toBeNull();
    createdId = res.body.id;
  });

  it('GET /v1/content liefert die Liste inkl. contentType-Relation', async () => {
    const res = await request(app.getHttpServer())
      .get('/v1/content')
      .set(auth())
      .expect(200);

    const entry = res.body.items.find(
      (item: { id: string }) => item.id === createdId,
    );
    expect(entry).toBeDefined();
    // Regressionstest: contentType wurde in ContentService.findAll() zunächst
    // nicht mitgeladen, was im Frontend zu einem Rendering-Fehler führte.
    expect(entry.contentType).toBeDefined();
    expect(entry.contentType.slug).toBe(contentTypeSlug);
  });

  it('GET /v1/content/:id liefert den einzelnen Eintrag', async () => {
    const res = await request(app.getHttpServer())
      .get(`/v1/content/${createdId}`)
      .set(auth())
      .expect(200);

    expect(res.body.title).toBe('E2E Testeintrag');
    expect(res.body.contentType).toBeDefined();
  });

  it('PATCH /v1/content/:id auf PUBLISHED setzt publishedAt und legt eine Version an', async () => {
    const versionsBefore = await prisma.contentVersion.count({
      where: { contentId: createdId },
    });

    const res = await request(app.getHttpServer())
      .patch(`/v1/content/${createdId}`)
      .set(auth())
      .send({ status: 'PUBLISHED' })
      .expect(200);

    expect(res.body.status).toBe('PUBLISHED');
    expect(res.body.publishedAt).not.toBeNull();

    const versionsAfter = await prisma.contentVersion.count({
      where: { contentId: createdId },
    });
    expect(versionsAfter).toBe(versionsBefore + 1);
  });

  it('Neuer Content bekommt robotsIndex/robotsFollow standardmäßig true', async () => {
    const res = await request(app.getHttpServer())
      .get(`/v1/content/${createdId}`)
      .set(auth())
      .expect(200);

    expect(res.body.robotsIndex).toBe(true);
    expect(res.body.robotsFollow).toBe(true);
  });

  it('PATCH /v1/content/:id speichert SEO-/OpenGraph-/Robots-Felder', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/v1/content/${createdId}`)
      .set(auth())
      .send({
        excerpt: 'E2E Kurzbeschreibung',
        seoTitle: 'E2E SEO-Titel',
        seoDescription: 'E2E Meta-Description',
        canonicalUrl: 'https://example.com/e2e',
        ogTitle: 'E2E OG-Titel',
        ogDescription: 'E2E OG-Beschreibung',
        ogImageUrl: '/uploads/e2e-og.png',
        twitterCard: 'summary_large_image',
        robotsIndex: false,
        robotsFollow: false,
      })
      .expect(200);

    expect(res.body.excerpt).toBe('E2E Kurzbeschreibung');
    expect(res.body.seoTitle).toBe('E2E SEO-Titel');
    expect(res.body.seoDescription).toBe('E2E Meta-Description');
    expect(res.body.canonicalUrl).toBe('https://example.com/e2e');
    expect(res.body.ogTitle).toBe('E2E OG-Titel');
    expect(res.body.ogDescription).toBe('E2E OG-Beschreibung');
    expect(res.body.ogImageUrl).toBe('/uploads/e2e-og.png');
    expect(res.body.twitterCard).toBe('summary_large_image');
    expect(res.body.robotsIndex).toBe(false);
    expect(res.body.robotsFollow).toBe(false);
  });

  it('PATCH /v1/content/:id lehnt ungültigen twitterCard-Wert ab (400)', async () => {
    await request(app.getHttpServer())
      .patch(`/v1/content/${createdId}`)
      .set(auth())
      .send({ twitterCard: 'not-a-valid-card-type' })
      .expect(400);
  });

  it('GET /v1/content/search ohne Token liefert 401', async () => {
    await request(app.getHttpServer())
      .get('/v1/content/search')
      .query({ q: 'Hallo' })
      .expect(401);
  });

  it('GET /v1/content/search ohne q liefert 400', async () => {
    await request(app.getHttpServer())
      .get('/v1/content/search')
      .set(auth())
      .expect(400);
  });

  it('GET /v1/content/search findet Treffer im dynamischen data-Body, nicht nur im Titel', async () => {
    // "Hallo Welt" steckt nur in `data.body`, nicht im Titel
    // ("E2E Testeintrag") – belegt, dass die Volltextsuche wirklich den
    // gesamten Inhalt durchsucht statt nur Titel/Excerpt.
    const res = await request(app.getHttpServer())
      .get('/v1/content/search')
      .query({ q: 'Hallo' })
      .set(auth())
      .expect(200);

    const hit = res.body.find((item: { id: string }) => item.id === createdId);
    expect(hit).toBeDefined();
    expect(hit.title).toBe('E2E Testeintrag');
  });

  it('GET /v1/content/search liefert leeres Array bei keinem Treffer', async () => {
    const res = await request(app.getHttpServer())
      .get('/v1/content/search')
      .query({ q: 'garantiert-kein-treffer-xyz-987654321' })
      .set(auth())
      .expect(200);

    expect(res.body).toEqual([]);
  });

  let categoryOneId: string;
  let categoryTwoId: string;

  it('POST /v1/content mit categoryIds ordnet Kategorien zu', async () => {
    const [catOne, catTwo] = await Promise.all([
      prisma.category.create({
        data: { name: 'E2E Content Kategorie 1', slug: 'e2e-content-kategorie-1' },
      }),
      prisma.category.create({
        data: { name: 'E2E Content Kategorie 2', slug: 'e2e-content-kategorie-2' },
      }),
    ]);
    categoryOneId = catOne.id;
    categoryTwoId = catTwo.id;

    const contentType = await prisma.contentType.findUniqueOrThrow({
      where: { slug: contentTypeSlug },
    });

    const res = await request(app.getHttpServer())
      .post('/v1/content')
      .set(auth())
      .send({
        title: 'E2E Content mit Kategorie',
        slug: 'e2e-content-mit-kategorie',
        contentTypeId: contentType.id,
        data: { body: 'x' },
        categoryIds: [categoryOneId],
      })
      .expect(201);

    expect(res.body.categories).toHaveLength(1);
    expect(res.body.categories[0].id).toBe(categoryOneId);

    await request(app.getHttpServer())
      .delete(`/v1/content/${res.body.id}`)
      .set(auth())
      .expect(200);
  });

  it('POST /v1/content mit unbekannter categoryId lehnt mit 400 ab', async () => {
    const contentType = await prisma.contentType.findUniqueOrThrow({
      where: { slug: contentTypeSlug },
    });

    await request(app.getHttpServer())
      .post('/v1/content')
      .set(auth())
      .send({
        title: 'E2E Content mit unbekannter Kategorie',
        slug: 'e2e-content-unbekannte-kategorie',
        contentTypeId: contentType.id,
        data: { body: 'x' },
        categoryIds: ['nicht-existent'],
      })
      .expect(400);
  });

  it('PATCH /v1/content/:id ersetzt die Kategorien-Zuordnung vollständig', async () => {
    await request(app.getHttpServer())
      .patch(`/v1/content/${createdId}`)
      .set(auth())
      .send({ categoryIds: [categoryOneId, categoryTwoId] })
      .expect(200);

    const withBoth = await request(app.getHttpServer())
      .get(`/v1/content/${createdId}`)
      .set(auth())
      .expect(200);
    expect(withBoth.body.categories).toHaveLength(2);

    const res = await request(app.getHttpServer())
      .patch(`/v1/content/${createdId}`)
      .set(auth())
      .send({ categoryIds: [categoryTwoId] })
      .expect(200);

    expect(res.body.categories).toHaveLength(1);
    expect(res.body.categories[0].id).toBe(categoryTwoId);
  });

  it('POST /v1/content mit status=SCHEDULED ohne scheduledFor liefert 400', async () => {
    const contentType = await prisma.contentType.findUniqueOrThrow({
      where: { slug: contentTypeSlug },
    });
    await request(app.getHttpServer())
      .post('/v1/content')
      .set(auth())
      .send({
        title: 'E2E Ohne Zeitpunkt',
        slug: 'e2e-ohne-zeitpunkt',
        contentTypeId: contentType.id,
        data: { body: 'x' },
        status: 'SCHEDULED',
      })
      .expect(400);
  });

  it('PATCH /v1/content/:id auf status=SCHEDULED ohne scheduledFor liefert 400', async () => {
    await request(app.getHttpServer())
      .patch(`/v1/content/${createdId}`)
      .set(auth())
      .send({ status: 'SCHEDULED' })
      .expect(400);
  });

  it('PATCH /v1/content/:id auf status=SCHEDULED mit scheduledFor setzt beides', async () => {
    const scheduledFor = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    const res = await request(app.getHttpServer())
      .patch(`/v1/content/${createdId}`)
      .set(auth())
      .send({ status: 'SCHEDULED', scheduledFor })
      .expect(200);

    expect(res.body.status).toBe('SCHEDULED');
    expect(res.body.scheduledFor).toBe(scheduledFor);
  });

  it('der Scheduler lässt einen erst in der Zukunft fälligen Inhalt unangetastet', async () => {
    const contentService = app.get(ContentService);
    const publishedCount = await contentService.publishDueScheduled();

    const still = await request(app.getHttpServer())
      .get(`/v1/content/${createdId}`)
      .set(auth())
      .expect(200);
    expect(still.body.status).toBe('SCHEDULED');
    // Nur zur Doku: andere, bereits fällige Test-Fixtures könnten den
    // Zähler > 0 machen, daher hier keine strikte 0-Prüfung.
    expect(publishedCount).toBeGreaterThanOrEqual(0);
  });

  it('der Scheduler veröffentlicht einen fälligen Inhalt automatisch', async () => {
    const pastDate = new Date(Date.now() - 60 * 1000);
    await prisma.content.update({
      where: { id: createdId },
      data: { scheduledFor: pastDate },
    });

    const contentService = app.get(ContentService);
    const publishedCount = await contentService.publishDueScheduled();
    expect(publishedCount).toBeGreaterThanOrEqual(1);

    const res = await request(app.getHttpServer())
      .get(`/v1/content/${createdId}`)
      .set(auth())
      .expect(200);
    expect(res.body.status).toBe('PUBLISHED');
    expect(res.body.publishedAt).not.toBeNull();
  });

  it('DELETE /v1/content/:id entfernt den Eintrag', async () => {
    await request(app.getHttpServer())
      .delete(`/v1/content/${createdId}`)
      .set(auth())
      .expect(200);

    await request(app.getHttpServer())
      .get(`/v1/content/${createdId}`)
      .set(auth())
      .expect(404);
  });
});
