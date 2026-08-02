# Projektplan – strasev CMS

## 1. Ziel

Ein modernes, headless-fähiges CMS als Monorepo: ein NestJS-Backend (REST-API,
PostgreSQL/Prisma) und ein Next.js-Frontend (Admin-Dashboard mit shadcn/ui).
Das System soll als Fundament für redaktionelle Websites/Produkte dienen und
von Anfang an auf gängige moderne CMS-Anforderungen ausgelegt sein: flexible
Content-Modelle, Rollen & Rechte, Versionierung, Medienverwaltung, SEO-Felder,
API-first-Zugriff.

## 2. Technologieentscheidungen

| Bereich | Wahl | Begründung |
|---|---|---|
| Monorepo-Tooling | Turborepo + pnpm Workspaces | Schnelles Caching, geringe Konfigurationslast, weit verbreitet in NestJS+Next.js-Setups |
| Backend | NestJS 11 (neueste Version) | Modulare Architektur, DI, sehr gute Unterstützung für REST/GraphQL/Microservices |
| ORM/DB | Prisma + PostgreSQL | Typsichere Queries, gute Migrations-DX, JSON-Felder für flexible Content-Modelle |
| Frontend | Next.js 16 (App Router) | Server Components, aktuelle React-19-Features, gute DX |
| UI-Komponenten | shadcn/ui (Base UI-Variante) | Eigentümerschaft über generierten Code, barrierefrei, gut anpassbar |
| Auth | JWT Access + Refresh Token Rotation | Zustandslos, skalierbar, Refresh-Token in DB widerrufbar |
| Validierung | zod (Backend-Config), class-validator (DTOs) | Laufzeitsichere Konfiguration, deklarative Request-Validierung |
| Caching/Queues (vorgesehen) | Redis | Für Sessions, Rate-Limiting-Backend, künftige Job-Queues |

Diese Entscheidungen wurden mit dem Projektverantwortlichen abgestimmt (siehe
Antworten in der Konversation vom 2026-08-02).

## 3. Projektstruktur (Monorepo)

```
strasev/
├── apps/
│   ├── api/     # NestJS Backend
│   └── web/     # Next.js Frontend (Admin-Dashboard)
├── packages/
│   └── database/ # Prisma Schema + generierter Client, gemeinsam genutzt
├── docs/         # Projektplan, Architektur, Roadmap, Features
├── knowledge-base/ # Laufend gepflegte Wissensdatenbank (siehe dort)
├── docker-compose.yml # Lokale Postgres + Redis Instanzen
├── turbo.json
├── pnpm-workspace.yaml
└── package.json
```

Details zur Architektur: siehe [ARCHITEKTUR.md](./ARCHITEKTUR.md).
Feature-Katalog: siehe [FEATURES.md](./FEATURES.md).
Phasenplan: siehe [ROADMAP.md](./ROADMAP.md).

## 4. Entwicklungs-Workflow

1. Lokale Infrastruktur starten: `docker compose up -d` (Postgres + Redis)
2. Abhängigkeiten installieren: `pnpm install`
3. Prisma-Client generieren & Migration ausführen:
   `pnpm db:generate && pnpm db:migrate`
4. Beide Apps starten: `pnpm dev` (Turborepo startet `apps/api` und `apps/web`
   parallel)
5. API-Doku: `http://localhost:3001/docs` (Swagger)
6. Admin-Dashboard: `http://localhost:3000`

Jedes neue Feature wird zusätzlich in der [Knowledge Base](../knowledge-base/INDEX.md)
dokumentiert – siehe dortigen Update-Prozess.

## 5. Nicht-Ziele (aktuell bewusst ausgeklammert)

- Kein Multi-Tenancy in der ersten Ausbaustufe (Datenmodell ist aber
  darauf vorbereitet, siehe `Site`-Erweiterung in der Roadmap)
- Kein GraphQL-Layer in Phase 1 (REST zuerst, GraphQL optional später)
- Keine Plugin-/Marketplace-Architektur in Phase 1

## 6. Offene Voraussetzungen für lokale Entwicklung

- Docker (für Postgres/Redis) war auf der Entwicklungsmaschine bei
  Projektanlage nicht installiert – muss vor dem ersten `db:migrate`
  nachgerüstet werden, alternativ eine lokale PostgreSQL-Instanz nutzen und
  `DATABASE_URL` in `apps/api/.env` sowie `packages/database/.env` anpassen.
