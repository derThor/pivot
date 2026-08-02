# Feature-Katalog – strasev CMS

Legende: ✅ umgesetzt (Grundgerüst) · 🚧 vorbereitet, aber unvollständig · ⏳ geplant

## Auth & Benutzerverwaltung

| Feature | Status | Hinweis |
|---|---|---|
| Registrierung / Login | ✅ | `POST /auth/register`, `/auth/login` |
| JWT Access + Refresh Token Rotation | ✅ | Refresh-Token widerrufbar in DB |
| Rollenbasierte Zugriffskontrolle (RBAC) | ✅ | Enum-Rollen: ADMIN, EDITOR, AUTHOR, VIEWER |
| Logout mit Token-Widerruf | ✅ | `POST /auth/logout` |
| Passwort-Hashing mit Argon2 | ✅ | Modernster empfohlener Algorithmus (OWASP) |
| Passwort-Reset per E-Mail | ⏳ | Benötigt Mail-Provider-Anbindung |
| 2FA/TOTP | ⏳ | |
| OAuth/Social Login (Google, GitHub, …) | ⏳ | |
| SSO/SAML | ⏳ | Für Enterprise-Ausbaustufe |

## Content-Management

| Feature | Status | Hinweis |
|---|---|---|
| Flexible Content-Typen (JSON-Schema) | ✅ | `ContentType.schema`, lesbar über `GET /content-types` |
| Content-CRUD mit Pagination/Filter | ✅ | Status- und Typ-Filter |
| Draft/Publish/Scheduled/Archived-Workflow | ✅ (Datenmodell) | Scheduler für `SCHEDULED` → `PUBLISHED` noch offen |
| Automatische Versionierung bei jedem Update | ✅ | `ContentVersion`-Historie |
| Versions-Diff & Rollback (UI) | ⏳ | Backend-Daten vorhanden, UI fehlt |
| Kategorien & Tags (n:m) | ✅ | Verwaltung (Anlegen/Löschen) über `/dashboard/taxonomy`; noch keine Zuordnung im Content-Editor |
| Mehrsprachigkeit (Locale-Feld) | 🚧 | Feld vorhanden, kein Locale-Switching in UI |
| SEO-Felder (Title, Description) | ✅ | Pro Content-Eintrag |
| Rich-Text/Block-Editor | ⏳ | z.B. Tiptap oder Plate geplant |
| Medienverwaltung (Upload, Alt-Text) | ✅ | `POST /media`, lokale Speicherung, Bild-Whitelist (10 MB) |
| Content-Vorschau (Preview-Links) | ⏳ | |
| Webhooks bei Publish/Update | ⏳ | |
| Volltextsuche | ⏳ | Kandidaten: Postgres `tsvector` oder Meilisearch |

## Plattform / DX

| Feature | Status | Hinweis |
|---|---|---|
| Monorepo mit Turborepo + pnpm | ✅ | |
| Typsichere DB-Zugriffe (Prisma) | ✅ | |
| OpenAPI/Swagger-Dokumentation | ✅ | `/docs` |
| Env-Validierung zur Boot-Zeit (zod) | ✅ | Fail-fast bei fehlerhafter Konfiguration |
| Rate-Limiting | ✅ | `@nestjs/throttler`, 100 Req/Min Startwert |
| Security-Header (Helmet) | ✅ | |
| API-Versionierung | ✅ | URI-basiert (`/v1`) |
| Audit-Log-Datenmodell | ✅ | Schreibende Anbindung in Services noch offen |
| Redis-Integration (Cache/Queues) | 🚧 | Container vorbereitet, keine Anbindung im Code |
| Automatisierte Tests (Unit/E2E) | 🚧 | E2E für Auth-/Content-Flow (16 Tests, eigene Testdatenbank); kein Unit-Test-Coverage, keine Frontend-Tests |
| CI/CD-Pipeline | ⏳ | |
| Dark Mode | ⏳ | shadcn/Tailwind-Theming vorbereitet, Umschalter fehlt |

## Admin-Dashboard (Frontend)

| Feature | Status | Hinweis |
|---|---|---|
| Sidebar-Navigation (shadcn `Sidebar`) | ✅ | Angelehnt an gängige Dashboard-Layouts |
| Login-Formular mit Validierung | ✅ | react-hook-form + zod, echte Anbindung an `POST /auth/login` inkl. httpOnly-Session-Cookies |
| Content-Übersicht (Tabelle) | ✅ | Live-Daten über `GET /content` |
| Dashboard-Statistiken | ✅ | Live-Zahlen (Content-Status-Counts, Nutzerzahl) |
| Auth-Gate für `/dashboard` | ✅ | Middleware-Redirect + stiller Token-Refresh, siehe [frontend-auth-flow.md](../knowledge-base/frontend-auth-flow.md) |
| Content-Editor (Formular je ContentType) | ✅ | Anlegen und Bearbeiten, dynamisch aus `ContentType.schema`; Löschen mit Bestätigung |
| Medien-Bibliothek (Grid, Upload) | ✅ | Alt-Text bearbeiten, Löschen mit Bestätigung (inkl. Datei), Vorschau-Popup; keine Bild-Dimensionen |
| Benutzerverwaltung-UI | ✅ | Liste, Anlegen, Rollen ändern; kein Löschen/Deaktivieren in der UI |
| Toaster/Benachrichtigungen | ✅ | `sonner` eingebunden |

Jedes neu umgesetzte Feature wird zusätzlich als eigener Eintrag in der
[Knowledge Base](../knowledge-base/INDEX.md) dokumentiert.
