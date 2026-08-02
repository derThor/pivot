# Architektur – strasev CMS

## Monorepo-Übersicht

```
apps/api      NestJS REST-API (Port 3001, Swagger unter /docs)
apps/web      Next.js Admin-Dashboard (Port 3000, App Router)
packages/database  Prisma-Schema + generierter Client (@strasev/database)
```

`apps/api` und `apps/web` referenzieren `@strasev/database` als
Workspace-Paket (`workspace:*`), sodass Backend und ggf. Frontend
(Server Components/Server Actions) denselben Prisma-Client und dieselben
generierten Typen nutzen.

## Backend (apps/api)

### Modulstruktur

```
src/
├── app.module.ts        # Root-Modul, globale Guards/Config
├── main.ts               # Bootstrap: Helmet, CORS, Versioning, Swagger, ValidationPipe
├── prisma/                # PrismaService (global bereitgestellt)
├── auth/                  # Login/Register/Refresh/Logout, JWT-Strategie, Guards
├── users/                 # Benutzerverwaltung (nur ADMIN)
├── content/                # Content-CRUD inkl. Versionierung
└── common/
    ├── config/env.validation.ts  # zod-basierte Env-Validierung
    └── utils/ms.ts               # Dauer-String-Parser (z.B. "15m")
```

### Auth-Flow

1. `POST /auth/register` bzw. `/auth/login` → Access-Token (JWT, kurzlebig,
   Default 15 Min) + Refresh-Token (zufälliger 384-Bit-String, in DB als
   SHA-256-Hash gespeichert, Default 30 Tage TTL).
2. Jeder nachfolgende Request trägt den Access-Token im
   `Authorization: Bearer <token>`-Header.
3. `POST /auth/refresh` rotiert das Refresh-Token: das alte wird als
   `revokedAt` markiert, ein neues Paar wird ausgestellt (schützt gegen
   Replay von gestohlenen Refresh-Tokens).
4. `POST /auth/logout` widerruft das übergebene Refresh-Token.
5. Globale Guards (`JwtAuthGuard`, `RolesGuard`) sichern standardmäßig alle
   Routen ab; `@Public()` markiert Ausnahmen (Login, Register, Refresh,
   Health-Check). `@Roles(Role.ADMIN, ...)` schränkt auf bestimmte Rollen ein.

### Datenmodell (Prisma, Auszug)

- `User` (Role-Enum: ADMIN, EDITOR, AUTHOR, VIEWER)
- `RefreshToken` (rotierend, widerrufbar)
- `ContentType` (flexibles JSON-Schema pro Content-Modell)
- `Content` (Status-Enum: DRAFT, SCHEDULED, PUBLISHED, ARCHIVED; JSON-Daten
  gemäß `ContentType.schema`; SEO-Felder; Locale für Mehrsprachigkeit)
- `ContentVersion` (wird bei jedem Update automatisch angelegt → Historie)
- `Category` / `Tag` (n:m über `ContentCategory` / `ContentTag`)
- `Media` (Upload-Metadaten)
- `AuditLog` (wer hat wann was gemacht)

Vollständiges Schema: [`packages/database/prisma/schema.prisma`](../packages/database/prisma/schema.prisma).

### Querschnittsthemen

- **Validierung**: `class-validator`/`class-transformer` auf DTO-Ebene,
  globale `ValidationPipe` mit `whitelist` + `forbidNonWhitelisted`.
- **Konfiguration**: `@nestjs/config` lädt `.env`, wird durch ein
  zod-Schema (`env.validation.ts`) zur Boot-Zeit geprüft – fehlende/ungültige
  Variablen lassen die App beim Start fehlschlagen statt später undefiniert
  zu funktionieren.
- **Sicherheit**: `helmet()` für HTTP-Header, CORS auf `CORS_ORIGIN`
  beschränkt, `@nestjs/throttler` als globales Rate-Limiting (100 Req/Min als
  Startwert).
- **API-Dokumentation**: Swagger/OpenAPI automatisch aus Decorators generiert,
  erreichbar unter `/docs`.
- **Versionierung**: URI-basiert (`/v1/...`), Health-Check bewusst
  versionsneutral (`/health`).

## Frontend (apps/web)

### Struktur

```
src/
├── app/
│   ├── layout.tsx           # Root-Layout: Fonts, TooltipProvider, Toaster
│   ├── page.tsx              # Redirect auf /dashboard
│   ├── login/page.tsx         # Login-Formular (react-hook-form + zod)
│   └── dashboard/
│       ├── layout.tsx          # Sidebar-Shell (SidebarProvider)
│       ├── page.tsx             # Übersicht/Stat-Kacheln
│       └── content/page.tsx     # Content-Liste (Tabelle)
├── components/
│   ├── app-sidebar.tsx     # Navigation (Content, Medien, Benutzer, Settings)
│   └── ui/                  # shadcn/ui-Komponenten (generierter Code)
└── lib/utils.ts
```

### UI-Basis: shadcn/ui auf Base UI

Die shadcn/ui-Version in diesem Projekt generiert Komponenten auf Basis von
**Base UI** (`@base-ui/react`) statt Radix. Wichtigster Unterschied für die
Weiterentwicklung: Polymorphie läuft über die **`render`-Prop**, nicht über
`asChild`:

```tsx
// Base UI-Pattern in diesem Projekt:
<Button render={<Link href="/dashboard/content/new" />}>Neuer Inhalt</Button>

// NICHT (Radix-Pattern, funktioniert hier nicht):
<Button asChild><Link href="...">...</Link></Button>
```

Diese Besonderheit ist auch in der [Knowledge Base](../knowledge-base/frontend-shadcn-base-ui.md)
festgehalten, da sie leicht zu Fehlern führt, wenn man mit "klassischem"
shadcn/Radix-Wissen an den Code geht.

### Datenanbindung

Aktuell sind die Admin-Seiten mit Platzhalterdaten vorbereitet (siehe
`entries: []` in `content/page.tsx`). Die Anbindung an die NestJS-API
(`fetch`/Server Actions gegen `http://localhost:3001/v1/...`) ist der nächste
Schritt gemäß [ROADMAP.md](./ROADMAP.md).

## Deployment (Ausblick, noch nicht umgesetzt)

- `apps/api`: containerisierbar (Node-Prozess, `dist/main.js`), benötigt
  PostgreSQL + gesetzte Env-Variablen (siehe `.env.example`)
- `apps/web`: Next.js-Standard-Deployment (Vercel oder Node-Server)
- Turborepo-Remote-Caching für CI ist vorbereitet, aber noch nicht
  konfiguriert (kein Remote-Cache-Token hinterlegt)
