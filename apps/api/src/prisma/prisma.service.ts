import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { PrismaClient } from '@pivot/database';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  async onModuleInit() {
    await this.$connect();
    await this.ensureSearchIndex();
    this.logger.log('Datenbankverbindung hergestellt');
  }

  /** Performance-Befund, 2026-08-25: `ContentService.search()`/
   * `searchCount()` berechnen `to_tsvector(...)` bislang bei jeder Anfrage
   * über die komplette Tabelle neu (jeder Tastendruck ab 3 Zeichen) – ohne
   * Index ein voller Sequential Scan. Prismas Schema-DSL kennt keine
   * Ausdrucks-Indizes über mehrere verkettete Spalten, deshalb hier per
   * rohem SQL statt in schema.prisma angelegt; `IF NOT EXISTS` macht das
   * bei jedem Start idempotent (kein separates Migrations-System in diesem
   * Projekt, siehe `db push`-Workflow). Der Ausdruck MUSS exakt dem in
   * `ContentService` entsprechen, sonst nutzt Postgres den Index nicht. */
  private async ensureSearchIndex() {
    await this.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS contents_search_idx ON contents
      USING GIN (to_tsvector('german',
        title || ' ' || coalesce(excerpt, '') || ' ' ||
        coalesce("seoTitle", '') || ' ' || coalesce("seoDescription", '') || ' ' ||
        data::text
      ));
    `);
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
