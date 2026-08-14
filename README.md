# pivot CMS

Modernes, headless-fähiges CMS als Monorepo: NestJS-Backend (REST-API,
PostgreSQL/Prisma) + Next.js-Admin-Dashboard (shadcn/ui).

- Projektplan: [`docs/PROJEKTPLAN.md`](./docs/PROJEKTPLAN.md)
- Architektur: [`docs/ARCHITEKTUR.md`](./docs/ARCHITEKTUR.md)
- Feature-Katalog: [`docs/FEATURES.md`](./docs/FEATURES.md)
- Roadmap: [`docs/ROADMAP.md`](./docs/ROADMAP.md)
- Knowledge Base (laufend gepflegt): [`knowledge-base/INDEX.md`](./knowledge-base/INDEX.md)

## Schnellstart

```bash
# 1. Lokale Infrastruktur (PostgreSQL + Redis)
docker compose up -d

# 2. Abhängigkeiten installieren
pnpm install

# 3. Datenbank vorbereiten
pnpm db:generate
pnpm db:migrate
pnpm --filter @pivot/database seed   # optional: Admin-User + Beispiel-ContentType

# 4. Beide Apps starten
pnpm dev
```

- API: http://localhost:3001 (Swagger-Doku: http://localhost:3001/docs)
- Admin-Dashboard: http://localhost:3000

## Struktur

```
apps/api        NestJS Backend
apps/web        Next.js Admin-Dashboard
packages/database  Gemeinsames Prisma-Package (@pivot/database)
docs/           Projektplan, Architektur, Roadmap, Features
knowledge-base/ Laufend aktualisierte technische Wissensdatenbank
```

## Voraussetzungen

- Node.js ≥ 22, pnpm (über `corepack enable` oder `npm i -g pnpm`)
- Docker (für lokale PostgreSQL/Redis) – alternativ eine eigene PostgreSQL-
  Instanz und `DATABASE_URL` in `apps/api/.env` sowie `packages/database/.env`
  anpassen
