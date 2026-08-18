# Feature-Katalog – pivot CMS

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
| 2FA/TOTP | ✅ | Self-Service-Einrichtung + Recovery-Codes, optionale Erzwingung für Admins, siehe [two-factor-authentication.md](../knowledge-base/auth/two-factor-authentication.md) |
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
| Medienverwaltung (Upload, Alt-Text) | ✅ | `POST /media`, lokale Speicherung, Bild/PDF/Video/Office-Whitelist (10/25/200 MB je Kategorie) |
| Content-Vorschau (Preview-Links) | ✅ | Zeitlich begrenzte Links (`/preview/[token]`) für unveröffentlichte/geplante Inhalte, ohne Login abrufbar; erstellen/kopieren/verlängern/widerrufen über Dialog im Content-Editor oder inhaltsübergreifend über `/dashboard/content/preview-links` |
| Automatische Veröffentlichung geplanter Inhalte | ✅ | `Content.scheduledFor` + `@nestjs/schedule`-Cron (jede Minute), schaltet fällige `SCHEDULED`-Inhalte automatisch auf `PUBLISHED` |
| Webhooks bei Publish/Update | ✅ | `/dashboard/webhooks`, Events `content.published`/`content.updated`, fire-and-forget-Zustellung (5s Timeout, kein Retry); Zustellstatus pro Webhook (Erfolg/Fehlschlag-Zähler) + Warnbanner bei fehlschlagenden Webhooks |
| Volltextsuche | ✅ | Bereichsübergreifend über `GET /v1/search`: Inhalte (Postgres `tsvector`, Präfix-Suche, Titel/SEO/gesamter dynamischer Body), Vorschau-Links (über den Titel des verknüpften Inhalts), Kategorien, Tags, Medien, Benutzer, Rollen – globale Such-Dropdown im Dashboard-Header, Treffer mit farbiger Bereichs-Badge, permission-gefiltert pro Bereich; Klick springt bei Inhalten direkt zum Editor, bei allen anderen Bereichen zur richtigen Seite der Listen-Ansicht mit markiertem Suchbegriff |
| Navigationsverwaltung | ✅ | Mehrere benannte Menüs (`/dashboard/navigation`), Einträge zeigen auf Inhalte oder externe URLs, beliebig tief verschachtelbar, Reihenfolge per Drag & Drop – deckt auch die frühere Seitenbaum-Idee ab (siehe `knowledge-base/content/navigation-management.md`) |

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
| Sidebar-Navigation (shadcn `Sidebar`) | ✅ | Angelehnt an gängige Dashboard-Layouts; Verwaltungs-Bereiche ohne Berechtigung werden ausgeblendet; "Verwaltung" selbst liegt im Header-Dropdown, nicht mehr in der Sidebar |
| Header: Verwaltung-Dropdown, Suchfeld, Benachrichtigungs-Glocke | ✅ | "Verwaltung"-Pille öffnet ein Dropdown mit Benutzer/Rollen & Rechte/Webhooks/Systemnachrichten/Firma/Datenschutz; direkt eintippbares Suchfeld mit Live-Ergebnissen (Strg K öffnet separat die Befehlspalette); Glocke verlinkt `/dashboard/system-messages`, roter Badge zeigt Anzahl aktiver Systemmeldungen |
| Login-Formular mit Validierung | ✅ | react-hook-form + zod, echte Anbindung an `POST /auth/login` inkl. httpOnly-Session-Cookies |
| Content-Übersicht (Tabelle) | ✅ | Stat-Kacheln (gesamt/veröffentlicht/Entwürfe/geplant), Spalten Titel/Pfad/Abschnitte/Status/Zuletzt bearbeitet/Aktionen, keine Massenauswahl (Nutzervorgabe, bewusste Ausnahme) |
| Dashboard-Statistiken | ✅ | Live-Zahlen (Content-Status-Counts, Nutzerzahl) |
| Auth-Gate für `/dashboard` | ✅ | Middleware-Redirect + stiller Token-Refresh, siehe [frontend-auth-flow.md](../knowledge-base/auth/frontend-auth-flow.md) |
| Content-Editor (Formular je ContentType) | ✅ | Anlegen und Bearbeiten, dynamisch aus `ContentType.schema`; zwei Tabs (Einstellungen & SEO zusammengelegt, Designer), Status als Segmented-Picker; Löschen mit Bestätigung |
| Autosave & Entwurfs-Wiederherstellung | ✅ | Lokaler Autosave im Browser (`localStorage`, debounced), Wiederherstellungs-Banner beim erneuten Öffnen; admin-abschaltbar in den Einstellungen |
| Content Locking | ✅ | Weiche Bearbeitungssperre pro Inhalt (2-Minuten-TTL, Heartbeat), schreibgeschütztes Formular + Banner bei Fremdsperre, Admin-Override; keine Konfliktauflösung/Merge (separates offenes Roadmap-Item) |
| Medien-Bibliothek (Masonry-Grid, Upload) | ✅ | Masonry-Grid mit Hover-Vorschau (Dateiname/Tags/Download); Klick öffnet Detailansicht in einer Seitenleiste (Format/Maße/Größe/Verwendet-in-N-Seiten/Tags); gebündeltes Bearbeiten-Popup (Alt-Text, Zuschneiden, Fokuspunkt, Verschieben), Duplizieren/Löschen über Menü; verschachtelte Ordner (anlegen/umbenennen/verschieben/löschen); Fokuspunkt (steuert das quadratische Thumbnail), Tags (gemeinsamer Pool mit Content, farbcodiert), Filter nach Dateityp/Tags, Erkennung ungenutzter Medien; automatische EXIF-Entfernung/Kompression/WebP-AVIF-Varianten + quadratisches 400px-Thumbnail beim Upload; Seiten-Designer-Baustein „Kacheln" (4 feste Bild-Slots im 2×2-Raster) |
| Benutzerverwaltung-UI | ✅ | Liste, Anlegen, vollständig bearbeiten (Name/E-Mail/Status/Rolle), Löschen mit Bestätigung + Selbstlöschschutz |
| Rollen-/Rechteverwaltung-UI | ✅ | `/dashboard/roles`, Split-View (Rollen-Liste + Detail-Panel mit Umfang-Anzeige, Kategorie-Tabs, Rechte-Karten pro Ressource), Rolle duplizieren, Rechte-Export als JSON |
| Einstellungen-UI | ✅ | 7-Bereiche-Sidebar (Zugriff & Funktionen, Sicherheit, Darstellung, Integrationen*, Datenschutz*, Benachrichtigungen*, Protokoll* – *noch Platzhalter): Passwort-Policy inkl. Leak-Prüfung/Wiederverwendungs-Sperre, Feature-Schalter (Wartungsmodus, Medien-Speicherkontingent, maximale Upload-Dateigröße), dreistufige 2FA-Pflicht, Sitzungs-Inaktivitäts-Timeout, Darstellung (Akzentfarbe, Tabellendichte, Logo); Sidebar-Logo und Auth-Bild sind fest hinterlegt, nicht mehr konfigurierbar |
| Firma-Seite (`/dashboard/company`) | ✅ | Eigene Seite unter Verwaltung (nicht mehr Teil der Einstellungen): Stammdaten (Impressum-/Datenschutz-Angaben), Vollständigkeits-Anzeige + Änderungsverlauf, mehrere Standorte |
| Datenschutz-Seite (`/dashboard/privacy`) | ✅ | Eigene Seite unter Verwaltung: Rechtstexte aus den Firmen-Stammdaten generiert (inkl. Verknüpfung zu einer echten Content-Seite), Aufbewahrungsfristen als Richtwerte + manuelle Löschen-Review-Listen (kein Auto-Löschen), Papierkorb für Inhalte/Medien/Kategorien/Tags, Löschanfragen/Verarbeitungsverzeichnis/Auftragsverarbeiter/Vorfälle (einfache CRUD-Listen), Datenschutzbeauftragter-Kontakt (inkl. Erwähnung in Rechtstexten, Vorfall-Benachrichtigung, monatlicher Bericht per Mail), CSV-Compliance-Bericht |
| Toaster/Benachrichtigungen | ✅ | `sonner`, drei Varianten (Erstellt/Bearbeitet/Gelöscht) global bei allen CRUD-Aktionen; zusätzlich `SystemMessage`-Komponente für dauerhafte Inline-Hinweise (Wartungsmodus, Speicher fast voll, Webhook-Fehlschläge, Sperren, ungespeicherte Änderungen) |
| Papierkorb (`/dashboard/trash`) | ✅ | Vereinheitlichte Papierkorb-Seite für Seiten/Medien/Kategorien/Tags/Galerien/FAQs (Formulare/Bausteine bewusst ausgenommen), eigener Sidebar-Eintrag unter Webseite: Löschen verschiebt jetzt app-weit nur noch in den Papierkorb, Stat-Kacheln, Ablauf-Warnbanner mit Sammel-Wiederherstellung, Filter mit Zählern/Suche, Massenauswahl, farbige Typ-Icons/Badges + Detail-Zeile pro Eintrag; nach Ablauf der Aufbewahrungsfrist nur Sperrung der Wiederherstellung, kein automatisches Löschen |
| Massenauswahl + Sammel-Löschen | ✅ | Checkbox pro Zeile/Karte + "Alle auswählen", Aktionsleiste mit Bestätigung – Konvention für alle Listen-Ansichten (Inhalte, Medien, Kategorien, Tags, Benutzer, Rollen, Versionshistorie) |
| Pagination | ✅ | URL-getriebene `?page=`-Navigation (Zurück/Weiter) auf allen Listen-Ansichten (Inhalte, Medien, Kategorien, Tags, Benutzer, Rollen, Versionshistorie); Seitengröße einstellbar unter Einstellungen → Darstellung |

Jedes neu umgesetzte Feature wird zusätzlich als eigener Eintrag in der
[Knowledge Base](../knowledge-base/INDEX.md) dokumentiert.
