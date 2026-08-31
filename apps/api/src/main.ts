import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe, VersioningType } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import type { Response } from 'express';
import { mkdirSync } from 'node:fs';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { UPLOAD_DIR } from './media/media.config';

async function bootstrap() {
  mkdirSync(UPLOAD_DIR, { recursive: true });

  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const config = app.get(ConfigService);

  // Hinter einem Reverse Proxy (Produktivbetrieb, siehe
  // knowledge-base/platform/deployment.md) käme sonst jede Anfrage von
  // 127.0.0.1: der globale ThrottlerGuard würde alle Nutzer in einen
  // gemeinsamen Zähler werfen und protokollierte IPs wären wertlos. Mit
  // "trust proxy" wertet Express X-Forwarded-For/-Proto aus – Wert 1, weil
  // genau ein vertrauenswürdiger Proxy davor steht.
  app.set('trust proxy', 1);

  // Vor helmet() registrieren: sonst würde helmets Cross-Origin-Resource-Policy
  // (same-origin) das Einbetten der Bilder vom Frontend-Origin (Port 3000) blockieren.
  //
  // SVG-Uploads sind erlaubt (Firmenlogo, Galerie-Icons) und können
  // eingebettetes <script> enthalten – als <img>/CSS-Hintergrund wird das
  // laut HTML-Spec nie ausgeführt, aber ein direkter Aufruf der Datei-URL
  // (Top-Level-Navigation) oder eine Einbettung per <iframe>/<object>
  // würde es ausführen (gespeichertes XSS im eigenen Origin, unauthentifiziert
  // erreichbar). Sicherheitsbefund, 2026-08-25: `Content-Disposition:
  // attachment` erzwingt bei SVGs einen Download statt einer Anzeige als
  // Dokument, eine eigene CSP auf der Antwort blockt zusätzlich <iframe>/
  // <object>-Einbettung – beides bricht die normale <img>-Nutzung nicht.
  app.useStaticAssets(UPLOAD_DIR, {
    prefix: '/uploads',
    setHeaders: (res: Response, path: string) => {
      if (path.toLowerCase().endsWith('.svg')) {
        res.setHeader('Content-Disposition', 'attachment');
        res.setHeader('Content-Security-Policy', "script-src 'none'");
      }
    },
  });
  app.use(helmet());
  app.enableCors({
    origin: config.get<string>('CORS_ORIGIN', 'http://localhost:3000'),
    credentials: true,
  });
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Sicherheitsbefund, 2026-08-25: `/docs` war unauthentifiziert erreichbar
  // und zeigte die komplette API-Landkarte (jede Route, jedes DTO-Feld)
  // jedem Besucher. Echtes Rollen-Gating ist hier technisch nicht sauber
  // möglich: Swagger UI wird per normaler Browser-Navigation geladen, ohne
  // Möglichkeit, dabei einen `Authorization`-Header oder das App-Cookie
  // (anderer Origin: API läuft auf Port 3001, das Zugriffstoken-Cookie
  // gehört zu Port 3000/dem Web-Frontend) mitzuschicken – ein Rechte-Guard
  // hätte hier schlicht nie eine gültige Sitzung zu sehen bekommen. Statt
  // eines unwirksamen Guards deshalb der in der Praxis übliche Weg: Swagger
  // nur außerhalb von Produktion mounten (dort ist es ohnehin nur ein
  // Entwickler-Werkzeug).
  if (config.get<string>('NODE_ENV') !== 'production') {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('pivot CMS API')
      .setDescription('REST API des pivot Headless CMS')
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('docs', app, document);
  }

  const port = config.get<number>('PORT', 3001);
  await app.listen(port);
  Logger.log(
    `API läuft auf http://localhost:${port} (Docs: /docs)`,
    'Bootstrap',
  );
}
void bootstrap();
