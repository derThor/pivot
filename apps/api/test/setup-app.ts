import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import { AppModule } from '../src/app.module';

/**
 * Sicherheitsnetz gegen versehentliches Testen gegen die Dev-Datenbank:
 * ein e2e-Lauf mit falschem NODE_ENV hat einmal echte Nutzerdaten
 * (Logo-Einstellungen) überschrieben, siehe knowledge-base/auth/
 * settings-and-password-policy.md ("Test-DB-Verwechslung"-Vorfall).
 */
function assertTestDatabase() {
  const url = process.env.DATABASE_URL ?? '';
  if (!url.includes('_test')) {
    throw new Error(
      `Refusing to run e2e tests: DATABASE_URL does not look like a test database (${url}). ` +
        'Stelle sicher, dass NODE_ENV=test gesetzt ist (z.B. via "pnpm test:e2e").',
    );
  }
}

export async function createTestApp(): Promise<INestApplication> {
  assertTestDatabase();
  const moduleFixture = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleFixture.createNestApplication();
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  await app.init();
  return app;
}
