# Architektur – pivot CMS

## Monorepo-Übersicht

```
apps/api      NestJS REST-API (Port 3001, Swagger unter /docs)
apps/web      Next.js Admin-Dashboard (Port 3000, App Router)
packages/database  Prisma-Schema + generierter Client (@pivot/database)
```

`apps/api` und `apps/web` referenzieren `@pivot/database` als
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
├── auth/                  # Login/Register/Refresh/Logout/Passwort/Verifikation, JWT-Strategie, Guards
├── users/                 # Benutzerverwaltung (Recht `users:manage`)
├── roles/                 # Rollen-/Rechteverwaltung (Recht `roles:manage`)
├── settings/               # Admin-Einstellungen, Passwort-Policy (Recht `settings:manage`)
├── mailer/                 # E-Mail-Versand (aktuell Dev-Stub, nur Logging)
├── content/                # Content-CRUD inkl. Versionierung
└── common/
    ├── config/env.validation.ts  # zod-basierte Env-Validierung
    └── utils/ms.ts               # Dauer-String-Parser (z.B. "15m")
```

### Auth-Flow

1. `POST /auth/register` bzw. `/auth/login` → Access-Token (JWT, kurzlebig,
   Default 15 Min) + Refresh-Token (zufälliger 384-Bit-String, in DB als
   SHA-256-Hash gespeichert, Default 30 Tage TTL). Der Access-Token trägt
   `{ sub, email, roleId, roleName, permissions: string[] }` – die Rechte
   der Rolle werden bei Ausstellung einmal geladen und eingebettet (wirken
   sich also erst beim nächsten Refresh aus, wenn sich die Rechte einer
   Rolle ändern).
2. Jeder nachfolgende Request trägt den Access-Token im
   `Authorization: Bearer <token>`-Header.
3. `POST /auth/refresh` rotiert das Refresh-Token: das alte wird als
   `revokedAt` markiert, ein neues Paar wird ausgestellt (schützt gegen
   Replay von gestohlenen Refresh-Tokens).
4. `POST /auth/logout` widerruft das übergebene Refresh-Token;
   `PATCH /auth/password` (Passwort ändern) und `POST /auth/reset-password`
   widerrufen **alle** Refresh-Tokens des Users.
5. Globale Guards (`JwtAuthGuard`, `PermissionsGuard`) sichern standardmäßig
   alle Routen ab; `@Public()` markiert Ausnahmen (Login, Register, Refresh,
   Verify-Email, Forgot/Reset-Password, Health-Check).
   `@RequirePermission('resource:action')` schränkt auf ein granulares
   Recht ein (z.B. `content:create`) – welche Rollen dieses Recht besitzen,
   ist frei über `/dashboard/roles` konfigurierbar. Details:
   [rbac-rework.md](../knowledge-base/auth/rbac-rework.md).

### Datenmodell (Prisma, Auszug)

- `User` (`firstName?`/`lastName`, `roleId`-FK, `emailVerifiedAt?`)
- `Role` / `Permission` / `RolePermission` (frei anlegbare Rollen, fester
  Rechte-Katalog im Code, n:m-Zuordnung)
- `AppSettings` (Singleton, `id=1`: Passwort-Policy, Feature-Schalter)
- `RefreshToken` / `EmailVerificationToken` / `PasswordResetToken`
  (rotierend bzw. einmalig, widerrufbar/verbrauchbar; alle drei speichern
  nur einen SHA-256-Hash, nie den Klartext-Token)
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

Diese Besonderheit ist auch in der [Knowledge Base](../knowledge-base/frontend/frontend-shadcn-base-ui.md)
festgehalten, da sie leicht zu Fehlern führt, wenn man mit "klassischem"
shadcn/Radix-Wissen an den Code geht.

### UI-Konvention: Anlegen → Bearbeiten + Löschen

Jede Ressource, die über die UI angelegt werden kann, muss auch bearbeitet
und gelöscht werden können. Löschen läuft nie direkt aus einer Aktion
heraus, sondern immer über die geteilte Komponente
`src/components/confirm-delete-dialog.tsx` (Bestätigen/Abbrechen-Popup).
Details und Hintergrund:
[Knowledge Base](../knowledge-base/frontend/ui-convention-crud-and-delete-confirmation.md).

### Datenanbindung

Server Components rufen die NestJS-API direkt server-seitig auf
(`lib/api-server.ts`, Access-Token aus dem httpOnly-Cookie). Mutationen
(Formulare, Buttons) laufen über Next.js Route Handler unter `app/api/*`,
die als schlanker BFF-Proxy den Access-Token aus dem Cookie lesen und an
die NestJS-API weiterreichen (der Browser hat selbst keinen Zugriff auf
das httpOnly-Cookie). Details zum Cookie-/Token-Handling:
[frontend-auth-flow.md](../knowledge-base/auth/frontend-auth-flow.md).

## Deployment (Ausblick, noch nicht umgesetzt)

- `apps/api`: containerisierbar (Node-Prozess, `dist/main.js`), benötigt
  PostgreSQL + gesetzte Env-Variablen (siehe `.env.example`)
- `apps/web`: Next.js-Standard-Deployment (Vercel oder Node-Server)
- Turborepo-Remote-Caching für CI ist vorbereitet, aber noch nicht
  konfiguriert (kein Remote-Cache-Token hinterlegt)
