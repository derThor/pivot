# Feature-Katalog – strasev CMS

Legende: ✅ umgesetzt (Grundgerüst) · 🚧 vorbereitet, aber unvollständig · ⏳ geplant

## Auth & Benutzerverwaltung

| Feature | Status | Hinweis |
|---|---|---|
| Registrierung / Login | ✅ | `POST /auth/register`, `/auth/login`; Registrierung über `/register`-Seite, abschaltbar per Einstellung; optionale Admin-Freischaltung vor erstem Login (Einstellung) |
| JWT Access + Refresh Token Rotation | ✅ | Refresh-Token widerrufbar in DB |
| Granulares Rollen-/Rechtesystem (RBAC) | ✅ | Frei anlegbare Rollen (`/dashboard/roles`), Rechte pro Ressource/Aktion (inkl. `read`) statt fester Rollen-Enum; `canAccessDashboard`-Flag pro Rolle |
| Logout mit Token-Widerruf | ✅ | `POST /auth/logout` |
| Passwort-Hashing mit Argon2 | ✅ | Modernster empfohlener Algorithmus (OWASP) |
| Konfigurierbare Passwort-Policy | ✅ | Mindestlänge + Zeichenvorgaben in `/dashboard/settings` einstellbar |
| Passwort ändern (Self-Service) | ✅ | `/dashboard/account`, widerruft alle Sessions |
| Passwort-Reset per E-Mail | ✅ (Dev-Stub) | Link wird geloggt/in Response zurückgegeben statt versendet; abschaltbar per Einstellung |
| E-Mail-Verifikation | ✅ (Dev-Stub) | Blockiert Login nicht, nur Dashboard-Hinweisbanner |
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
| Versions-Diff & Rollback (UI) | ✅ | `GET /content/:id/versions`, `POST .../rollback`; Feld-für-Feld-Wortdiff gegen den aktuellen Stand |
| Kategorien & Tags (n:m) | ✅ | Verwaltung (Anlegen/Bearbeiten/Löschen) über eigene Menüpunkte `/dashboard/categories` und `/dashboard/tags`; Kategorien mit Beschreibungsfeld; Kategorien-Zuordnung im Content-Editor + Anzeige in der Content-Liste; Tags noch nicht mit Content verknüpft |
| Mehrsprachigkeit (Locale-Feld) | 🚧 | Feld vorhanden, kein Locale-Switching in UI |
| SEO-Felder | ✅ | Pro Content-Eintrag im eigenen "SEO"-Tab des Editors: SEO-Titel, Meta-Description, Excerpt, Canonical-URL, OpenGraph (Titel/Beschreibung/Bild), Twitter-Card-Typ, Robots-Attribute (index/follow) – Felder existierten teils schon im Schema, waren aber bis 2026-08-06 nirgends im UI editierbar |
| Rich-Text/Block-Editor | ✅ | Tiptap (Core + StarterKit); Überschriften H1-H6, Code-Block, HTML-Quellcode-Ansicht, Bild einfügen (Medienbibliothek/Upload) + Ausrichtung |
| Medienverwaltung (Upload, Alt-Text) | ✅ | `POST /media`, lokale Speicherung, Bild-Whitelist (10 MB) |
| Content-Vorschau (Preview-Links) | ⏳ | |
| Webhooks bei Publish/Update | ⏳ | |
| Volltextsuche | ✅ | Bereichsübergreifend über `GET /v1/search`: Inhalte (Postgres `tsvector`, Präfix-Suche, Titel/SEO/gesamter dynamischer Body), Kategorien, Tags, Medien, Benutzer, Rollen – globale Such-Dropdown im Dashboard-Header, Treffer mit farbiger Bereichs-Badge, permission-gefiltert pro Bereich |

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
| Sidebar-Navigation (shadcn `Sidebar`) | ✅ | Angelehnt an gängige Dashboard-Layouts; Verwaltungs-Bereiche ohne Berechtigung werden ausgeblendet |
| Login-Formular mit Validierung | ✅ | react-hook-form + zod, echte Anbindung an `POST /auth/login` inkl. httpOnly-Session-Cookies |
| Content-Übersicht (Tabelle) | ✅ | Live-Daten über `GET /content` |
| Dashboard-Statistiken | ✅ | Live-Zahlen (Content-Status-Counts, Nutzerzahl) |
| Auth-Gate für `/dashboard` | ✅ | Middleware-Redirect + stiller Token-Refresh, siehe [frontend-auth-flow.md](../knowledge-base/auth/frontend-auth-flow.md) |
| Content-Editor (Formular je ContentType) | ✅ | Anlegen und Bearbeiten, dynamisch aus `ContentType.schema`; Löschen mit Bestätigung |
| Autosave & Entwurfs-Wiederherstellung | ✅ | Lokaler Autosave im Browser (`localStorage`, debounced), Wiederherstellungs-Banner beim erneuten Öffnen; admin-abschaltbar in den Einstellungen |
| Content Locking | ✅ | Weiche Bearbeitungssperre pro Inhalt (2-Minuten-TTL, Heartbeat), schreibgeschütztes Formular + Banner bei Fremdsperre, Admin-Override; keine Konfliktauflösung/Merge (separates offenes Roadmap-Item) |
| Medien-Bibliothek (Grid, Upload) | ✅ | Alt-Text bearbeiten, Löschen mit Bestätigung (inkl. Datei), Vorschau-Popup; verschachtelte Ordner (anlegen/umbenennen/verschieben/löschen); keine Bild-Dimensionen |
| Benutzerverwaltung-UI | ✅ | Liste, Anlegen, vollständig bearbeiten (Name/E-Mail/Status/Rolle), Löschen mit Bestätigung + Selbstlöschschutz |
| Rollen-/Rechteverwaltung-UI | ✅ | `/dashboard/roles`, Checkbox-Matrix für Rechte pro Rolle |
| Einstellungen-UI | ✅ | Passwort-Policy, Feature-Schalter, Darstellung, Firma (Logo-Upload aus-/eingeklappt + Impressum-/Datenschutz-Angaben) |
| Toaster/Benachrichtigungen | ✅ | `sonner` eingebunden |
| Massenauswahl + Sammel-Löschen | ✅ | Checkbox pro Zeile/Karte + "Alle auswählen", Aktionsleiste mit Bestätigung – Konvention für alle Listen-Ansichten (Inhalte, Medien, Kategorien, Tags, Benutzer, Rollen, Versionshistorie) |
| Pagination | ✅ | URL-getriebene `?page=`-Navigation (Zurück/Weiter) auf allen Listen-Ansichten (Inhalte, Medien, Kategorien, Tags, Benutzer, Rollen, Versionshistorie); Seitengröße einstellbar unter Einstellungen → Darstellung |

Jedes neu umgesetzte Feature wird zusätzlich als eigener Eintrag in der
[Knowledge Base](../knowledge-base/INDEX.md) dokumentiert.
