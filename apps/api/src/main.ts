import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe, VersioningType } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { mkdirSync } from 'node:fs';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { UPLOAD_DIR } from './media/media.config';

async function bootstrap() {
  mkdirSync(UPLOAD_DIR, { recursive: true });

  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const config = app.get(ConfigService);

  // Vor helmet() registrieren: sonst würde helmets Cross-Origin-Resource-Policy
  // (same-origin) das Einbetten der Bilder vom Frontend-Origin (Port 3000) blockieren.
  app.useStaticAssets(UPLOAD_DIR, { prefix: '/uploads' });
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

  const swaggerConfig = new DocumentBuilder()
    .setTitle('pivot CMS API')
    .setDescription('REST API des pivot Headless CMS')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, document);

  const port = config.get<number>('PORT', 3001);
  await app.listen(port);
  Logger.log(
    `API läuft auf http://localhost:${port} (Docs: /docs)`,
    'Bootstrap',
  );
}
void bootstrap();
