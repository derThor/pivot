# Monorepo-Grundgerüst (Turborepo + pnpm)

**Datum:** 2026-08-02
**Betroffene Bereiche:** Root, apps/api, apps/web, packages/database

## Was wurde gebaut

Ein pnpm-Workspace mit Turborepo als Task-Runner:
- `apps/api` – NestJS 11, generiert via `@nestjs/cli@latest new`
- `apps/web` – Next.js 16 (App Router, Turbopack), generiert via
  `create-next-app@latest`
- `packages/database` – gemeinsames Prisma-Package (`@strasev/database`)
- `docker-compose.yml` für lokale PostgreSQL 17 + Redis 7

Root-Skripte (`pnpm dev`, `pnpm build`, `pnpm lint`, `pnpm type-check`)
delegieren über `turbo.json` an die einzelnen Packages.

## Warum diese Lösung

Turborepo + pnpm wurde gegenüber Nx (mehr Konventionen/Boilerplate) und
reinen pnpm-Workspaces (kein Build-Caching/Orchestrierung) bewusst gewählt,
weil es für ein Zwei-App-Setup (API + Web) die beste Balance aus Einfachheit
und Build-Performance bietet. Entscheidung wurde explizit mit dem
Projektverantwortlichen abgestimmt.

## Stolpersteine / Besonderheiten

- **pnpm blockiert Postinstall-Skripte standardmäßig** (`ERR_PNPM_IGNORED_BUILDS`).
  Betroffene, hier bewusst freigegebene Pakete: `sharp`, `unrs-resolver`,
  `@prisma/client`, `@prisma/engines`, `prisma`, `argon2`, `esbuild`
  (alle offizielle, notwendige native Build-Skripte). `@scarf/scarf`
  (reine Telemetrie einer Sub-Dependency) wurde bewusst **nicht** freigegeben.
  Freigaben stehen in `pnpm-workspace.yaml` unter `allowBuilds`. Details:
  [tooling-pnpm-build-approvals.md](./tooling-pnpm-build-approvals.md).
- **Interne Packages nicht per `pnpm add` aus der Registry auflösbar**:
  `pnpm add @strasev/database` schlägt mit 404 fehl, da das Paket nicht
  veröffentlicht ist. Workspace-Abhängigkeiten müssen manuell als
  `"@strasev/database": "workspace:*"` in die `package.json` eingetragen und
  danach per `pnpm install` (vom Root aus) verlinkt werden.
- `create-next-app` legt bei Ausführung außerhalb des Zielordners eine eigene
  `pnpm-workspace.yaml`/`pnpm-lock.yaml`/`node_modules` im neuen Unterordner
  an – diese wurden entfernt, damit `apps/web` sauber Teil des Root-Workspace
  ist, statt selbst ein verschachteltes Workspace zu sein.

## Relevante Dateien

- `package.json`, `pnpm-workspace.yaml`, `turbo.json` (Root)
- `docker-compose.yml`
- `apps/api/package.json`, `apps/web/package.json`, `packages/database/package.json`

## Offene Punkte

- Kein CI/CD, kein Turborepo-Remote-Cache konfiguriert (siehe
  [ROADMAP.md](../../docs/ROADMAP.md) Phase 3).
- Docker war auf der Entwicklungsmaschine nicht installiert – lokale
  Postgres/Redis-Instanzen müssen vor `pnpm db:migrate` bereitstehen.
