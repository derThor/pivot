# Knowledge Base – strasev CMS

Diese Knowledge Base hält technisches Wissen fest, das sich nicht allein aus
dem Code erschließt: Entscheidungen, Stolpersteine, Konventionen und der
Stand einzelner Features. Sie ergänzt die [Projektplan-Dokumente](../docs/)
(die eher "wohin wollen wir" beantworten) um "was haben wir gebaut und warum
genau so".

**Update-Prozess: siehe [PROCESS.md](./PROCESS.md).** Kurzfassung: bei jedem
neuen Feature wird hier ein Eintrag ergänzt oder ein bestehender aktualisiert
– das ist keine Ausnahme, sondern Teil der Feature-Definition-of-Done.
Einträge sind nach Themenbereich in Unterordnern gruppiert (Regel für neue
Themenbereiche/Umgruppierungen: siehe [PROCESS.md](./PROCESS.md)).

## Auth (`auth/`)

| Datei | Thema | Zuletzt aktualisiert |
|---|---|---|
| [auth-jwt-refresh-rotation.md](./auth/auth-jwt-refresh-rotation.md) | JWT Auth, Refresh-Token-Rotation, RBAC (Backend) | 2026-08-02 |
| [frontend-auth-flow.md](./auth/frontend-auth-flow.md) | httpOnly-Cookie-Session via BFF-Route-Handler + Middleware-Gate/Silent-Refresh (Frontend) | 2026-08-02 |
| [rbac-rework.md](./auth/rbac-rework.md) | Von 4 festen Rollen zu granularem, admin-verwaltbarem RBAC (Role/Permission-Tabellen) | 2026-08-03 |
| [settings-and-password-policy.md](./auth/settings-and-password-policy.md) | Admin-Einstellungen (Singleton), konfigurierbare Passwort-Policy, Logo-Upload + Firmenangaben | 2026-08-05 |
| [self-service-auth-flows.md](./auth/self-service-auth-flows.md) | Registrierung, E-Mail-Verifikation (Dev-Stub), Passwort ändern/vergessen, Self-Service-Profil | 2026-08-03 |
| [admin-activation-and-permission-nav.md](./auth/admin-activation-and-permission-nav.md) | Admin-Freischaltung für Registrierungen (Einstellung), rollenabhängige Navigation | 2026-08-03 |
| [read-permissions-and-dashboard-access.md](./auth/read-permissions-and-dashboard-access.md) | Lese-Rechte pro Ressource (`content:read` etc.) + `Role.canAccessDashboard`, neue Default-Rolle "Nutzer" | 2026-08-03 |

## Content (`content/`)

| Datei | Thema | Zuletzt aktualisiert |
|---|---|---|
| [content-versioning.md](./content/content-versioning.md) | Content-Modell, automatische Versionierung | 2026-08-02 |
| [content-editor-dynamic-forms.md](./content/content-editor-dynamic-forms.md) | Content-Types-API + dynamisch aus `ContentType.schema` generiertes Editor-Formular, zweispaltiges Layout (Einstellungen links, Editor rechts) | 2026-08-06 |
| [content-edit-delete.md](./content/content-edit-delete.md) | Content bearbeiten (Edit-Formular) und löschen (mit Bestätigung, kaskadiert automatisch auf Versionen) | 2026-08-04 |
| [rich-text-and-versioning.md](./content/rich-text-and-versioning.md) | Rich-Text-Editor (Tiptap, inkl. H1-H6/Code/Bilder) + Versions-Diff & Rollback-UI, HTML-Diff/Vorschau als Tabs | 2026-08-06 |
| [content-categories.md](./content/content-categories.md) | Kategorien-Zuordnung im Content-Editor (n:m, `ContentCategory`), ausgewählte Kategorien als entfernbare Badges | 2026-08-06 |
| [content-seo-fields.md](./content/content-seo-fields.md) | SEO-Tab im Content-Editor (SEO-Titel/Meta-Description/Excerpt/Canonical-URL/OpenGraph/Twitter-Card/Robots), Info-Tooltips, OG-Bild-Direkt-Upload | 2026-08-06 |
| [content-autosave.md](./content/content-autosave.md) | Autosave (lokal, `localStorage`, debounced) + Entwurfs-Wiederherstellungs-Banner im Content-Editor, admin-abschaltbar | 2026-08-06 |
| [content-locking.md](./content/content-locking.md) | Weiche Bearbeitungssperre (2-Minuten-TTL, Heartbeat), schreibgeschütztes Formular bei Fremdsperre, Admin-Override | 2026-08-06 |
| [publishing-automation.md](./content/publishing-automation.md) | Scheduler (`Content.scheduledFor` + Cron) für automatisches Veröffentlichen, Webhooks bei Publish/Update-Events, eigener portal-basierter `DateTimePicker` | 2026-08-06 |
| [content-preview-links.md](./content/content-preview-links.md) | Signierte, zeitlich begrenzte Vorschau-Links (`/preview/[token]`, öffentlich, unabhängig vom Content-Status) | 2026-08-06 |
| [global-search.md](./content/global-search.md) | Globale Suche über Inhalte (Postgres `tsvector` Präfix-Match), Vorschau-Links, Kategorien, Tags, Medien, Benutzer und Rollen, farbige Bereichs-Badges, Deep-Link + Wort-Markierung + Pagination-Sprung beim Klick auf einen Treffer | 2026-08-06 |
| [navigation-management.md](./content/navigation-management.md) | Navigationsverwaltung (mehrere benannte Menüs, Einträge beliebig tief verschachtelbar, zeigen auf Inhalte oder externe URLs); dokumentiert auch den am selben Tag zurückgebauten "Seitenbaum"-Ansatz | 2026-08-06 |
| [page-designer.md](./content/page-designer.md) | Seiten-Designer: `ModuleType`-Modell (öffentlich lesbar) + Feldtyp `"modules"`, Gutenberg-artiger Block-Editor mit Bild-Resize/Ausrichtung (echtes CSS-Float) und Block-Level-Layout für Nicht-Bild-Bausteine (Zitat etc., reihen sich neben ausgerichtetem Bild ein); inkl. Bugfixes (öffentliche Vorschau, Doppel-Breiten-Anwendung) und der sechs verworfenen Vorläufer | 2026-08-08 |

## Medien (`media/`)

| Datei | Thema | Zuletzt aktualisiert |
|---|---|---|
| [media-upload.md](./media/media-upload.md) | Medien-Upload (lokal) + Medien-Bibliothek-UI | 2026-08-02 |
| [media-edit-delete.md](./media/media-edit-delete.md) | Medien bearbeiten (Alt-Text) und löschen (inkl. Datei von Disk) | 2026-08-02 |
| [media-preview.md](./media/media-preview.md) | Medien-Vorschau-Popup; `next/headers`-Stolperstein in Client-Komponenten | 2026-08-02 |
| [media-folders.md](./media/media-folders.md) | Verschachtelte Ordner in der Medienbibliothek, Verschieben, Ordner-Navigation im Bild-Picker | 2026-08-04 |

## Frontend – allgemein (`frontend/`)

| Datei | Thema | Zuletzt aktualisiert |
|---|---|---|
| [frontend-shadcn-base-ui.md](./frontend/frontend-shadcn-base-ui.md) | shadcn/ui auf Base-UI-Basis, `render`-statt-`asChild`-Pattern, `nativeButton`-Stolperstein | 2026-08-03 |
| [ui-convention-crud-and-delete-confirmation.md](./frontend/ui-convention-crud-and-delete-confirmation.md) | Konvention: Anlegen→Bearbeiten+Löschen, Löschen immer mit Bestätigungs-Popup (`ConfirmDeleteDialog`) + Massenauswahl | 2026-08-04 |
| [bulk-selection-and-delete.md](./frontend/bulk-selection-and-delete.md) | Massenauswahl + Sammel-Löschen für alle Listen-Ansichten (`useSelection`, `SelectionToolbar`) | 2026-08-04 |
| [pagination.md](./frontend/pagination.md) | URL-getriebene Pagination (`?page=`) für alle Listen-Seiten (`PaginationControls`) | 2026-08-05 |
| [design-refresh.md](./frontend/design-refresh.md) | Koralle/Orange-Theme, Sidebar/Header-Neugestaltung, Kebab-Menüs in allen Listen | 2026-08-05 |
| [user-management-ui.md](./frontend/user-management-ui.md) | Benutzerverwaltung-UI (Liste, Anlegen, Rollen ändern) | 2026-08-02 |
| [taxonomy-management.md](./frontend/taxonomy-management.md) | Kategorien/Tags-Verwaltung (CRUD inkl. Bearbeiten, Kategorie-Beschreibung, eigene Menüpunkte) | 2026-08-05 |
| [user-edit-delete.md](./frontend/user-edit-delete.md) | Benutzer vollständig bearbeiten (Name/E-Mail/Status) und löschen (mit Selbstlöschschutz) | 2026-08-02 |

## Tooling & Infrastruktur (`tooling/`)

| Datei | Thema | Zuletzt aktualisiert |
|---|---|---|
| [monorepo-setup.md](./tooling/monorepo-setup.md) | Turborepo/pnpm-Grundgerüst, Workspace-Struktur | 2026-08-02 |
| [tooling-pnpm-build-approvals.md](./tooling/tooling-pnpm-build-approvals.md) | pnpm-Build-Skript-Freigaben (`allowBuilds`) | 2026-08-02 |
| [e2e-testing-setup.md](./tooling/e2e-testing-setup.md) | Erste E2E-Tests (Auth-/Content-Flow), eigene Testdatenbank | 2026-08-02 |

## Offene Wissenslücken (bewusst vermerkt)

- Kein Eintrag zu Deployment/CI, da noch nicht umgesetzt (siehe
  [ROADMAP.md](../docs/ROADMAP.md) Phase 3)
- Kein Eintrag zu Redis-Nutzung, da Container nur vorbereitet, aber nicht
  angebunden ist
