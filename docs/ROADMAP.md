# Roadmap – strasev CMS

## Phase 0 – Grundgerüst (abgeschlossen, 2026-08-02)

- Monorepo (Turborepo + pnpm) aufgesetzt
- NestJS-Backend mit Auth (JWT + Refresh Rotation), Users- und
  Content-Modul, Prisma-Schema, Swagger, Security-Header, Rate-Limiting
- Next.js-Frontend mit shadcn/ui: Dashboard-Layout, Sidebar, Login-Formular,
  Content-Übersicht (Platzhalterdaten)
- Knowledge Base initialisiert

## Phase 1 – End-to-End MVP

- [x] Frontend an die API anbinden (Login-Flow, Token-Handling,
      Content-Liste mit echten Daten)
- [x] Content-Editor-Formular (dynamisch aus `ContentType.schema` generiert)
- [x] Medien-Upload-Endpoint (lokal oder S3-kompatibel) + Medien-Bibliothek-UI
- [x] Benutzerverwaltung-UI (Liste, Anlegen, Rollen ändern)
- [x] Kategorien/Tags-Verwaltung (Backend-Endpoints + UI)
- [x] Erste automatisierte Tests für Auth- und Content-Flows

## Phase 2a – Auth-Härtung (vorgezogen, abgeschlossen 2026-08-03)

Auf Nutzerwunsch vor dem weiteren Phase-2-Ausbau (jetzt Phase 2b)
eingeschoben, da Auth/Security das Fundament ist, auf dem alles andere
aufsetzt.

- [x] Granulares, admin-verwaltbares Rollen-/Rechtesystem (freie
      Rollen-Erstellung statt 4 fester Rollen, Rechte pro Ressource/Aktion)
- [x] Admin-Einstellungen (`/dashboard/settings`, bis dahin funktionsloser
      Nav-Punkt): konfigurierbare Passwort-Policy, Registrierung/
      Passwort-Reset/E-Mail-Änderung an- oder abschaltbar
- [x] Passwort-Bestätigungsfeld beim Anlegen/Ändern, Zeichenvorgaben laut
      Policy (Live-Checkliste im Formular)
- [x] Registrierungsseite (Vorname/Nachname/E-Mail/Passwort), respektiert
      die Registrierung-erlaubt-Einstellung
- [x] E-Mail-Verifikation (Dev-Stub – Link wird geloggt/in der Antwort
      zurückgegeben, kein echter Mail-Versand; siehe Phase 3
      "Passwort-Reset per E-Mail" für echten Versand)
- [x] Passwort-vergessen-Funktion, ebenfalls abschaltbar
- [x] Self-Service-Konto-Seite (Profil bearbeiten, Passwort ändern)
- [x] Admin-Freischaltung für Registrierungen (per Einstellung an-/
      abschaltbar) + Navigation blendet Bereiche ohne Berechtigung aus
- [x] Lese-Rechte pro Ressource (`content:read` etc., vorher war Lesen
      ungeschützt) + `Role.canAccessDashboard` als eigenes Flag; neue
      Default-Rolle "Nutzer" (0 Rechte, kein Dashboard-Zugriff) für
      Selbstregistrierung statt bisher "Autor"

Details: [rbac-rework.md](../knowledge-base/auth/rbac-rework.md),
[settings-and-password-policy.md](../knowledge-base/auth/settings-and-password-policy.md),
[self-service-auth-flows.md](../knowledge-base/auth/self-service-auth-flows.md),
[admin-activation-and-permission-nav.md](../knowledge-base/auth/admin-activation-and-permission-nav.md),
[read-permissions-and-dashboard-access.md](../knowledge-base/auth/read-permissions-and-dashboard-access.md).

## Phase 2b – Redaktionelle Reife

### 2b.1 – CRUD-Vervollständigung (abgeschlossen, 2026-08-02)

- [x] Content bearbeiten (Edit-Formular für bestehende Einträge; Backend
      `PATCH /content/:id` existiert bereits) und löschen (`DELETE
      /content/:id` existiert bereits) im Frontend nutzen
- [x] Medien bearbeiten (Alt-Text ändern) und löschen – Backend-Endpoint
      `DELETE /media/:id` fehlt noch komplett, nicht nur die UI
- [x] Benutzer vollständig bearbeiten (Name/E-Mail/Aktiv-Status, nicht nur
      Rolle) und löschen – Backend-Endpoints `PATCH`/`DELETE /users/:id`
      existieren bereits, im Frontend bisher nur Rollen-Änderung genutzt
- [x] Kategorien/Tags bearbeiten (`PATCH`-Endpoints + Edit-Dialog, vorher
      nur Anlegen/Löschen), Kategorien mit Beschreibungsfeld, eigene
      Menüpunkte `/dashboard/categories`/`/dashboard/tags` statt einer
      kombinierten Seite (nachträglich ergänzt, 2026-08-04)
- [x] Massenauswahl + Sammel-Löschen als feste Konvention für alle
      Listen-Ansichten (Inhalte, Medien, Kategorien, Tags, Benutzer,
      Rollen, Content-Versionshistorie); Versionshistorie bekommt dabei
      auch erstmals Einzel-Löschen pro Version (nachträglich ergänzt,
      2026-08-04)
- [x] Verschachtelte Ordner in der Medienbibliothek (anlegen/umbenennen/
      verschieben/löschen, inkl. kaskadierendem Löschen nicht-leerer
      Ordner mit Warnung), Ordner-Navigation auch im Bild-Picker des
      Rich-Text-Editors (nachträglich ergänzt, 2026-08-04)
- [x] Pagination auf allen Listen-Ansichten (Inhalte, Medien, Kategorien,
      Tags, Benutzer, Rollen, Versionshistorie), URL-getrieben über
      `?page=`; Seitengröße einstellbar (2026-08-04)
- [x] Kategorien-Zuordnung im Content-Editor (Mehrfachauswahl-Dropdown,
      ersetzt die Zuordnung vollständig beim Speichern), Anzeige in der
      Content-Liste (2026-08-05)
- [x] Design-Überarbeitung (Koralle/Orange-Theme, Sidebar/Header neu,
      einheitliche Kartenschatten, Kebab-Menüs in allen Listen)
      (2026-08-05)
- [x] Admin-konfigurierbares Logo (aus-/eingeklappte Sidebar) +
      Firmenangaben für Impressum/Datenschutz in den Einstellungen
      (2026-08-05)

### 2b.2 – Content-Authoring (abgeschlossen, 2026-08-04)

- [x] Rich-Text/Block-Editor für Content-Body (Tiptap Core + StarterKit,
      HTML-String-Ausgabe)
- [x] Versions-Diff & Rollback-UI (`GET /content/:id/versions`, `POST
      .../rollback`, Feld-für-Feld-Wortdiff gegen den aktuellen Stand)

Details: [rich-text-and-versioning.md](../knowledge-base/content/rich-text-and-versioning.md).

### 2b.3 – Publishing-Automatisierung (abgeschlossen, 2026-08-06)

- [x] Scheduler-Job: `SCHEDULED` → `PUBLISHED` zum Zielzeitpunkt – neues
      Feld `Content.scheduledFor` (existierte vorher gar nicht, obwohl
      der `SCHEDULED`-Status schon lange wählbar war), `@nestjs/schedule`-
      Cron-Job jede Minute statt Redis/BullMQ (Redis ist im Projekt noch
      nicht angebunden, siehe Phase 3 – ein zusätzlicher Queue-Betrieb
      nur für diesen einen periodischen Job wäre unverhältnismäßig)
- [x] Webhooks bei Publish/Update-Events – eigenes CRUD
      (`/dashboard/webhooks`, Events `content.published`/
      `content.updated`), fire-and-forget-Zustellung mit Timeout, feuert
      sowohl bei manuellem Statuswechsel als auch beim automatischen
      Scheduler-Publish

### 2b.4 – Auffindbarkeit

- [x] Volltextsuche (Postgres `tsvector` als erster Schritt) – globale
      Such-Dropdown im Dashboard-Header, durchsucht bereichsübergreifend
      Inhalte (Titel, Excerpt, SEO-Felder, kompletter dynamischer Body),
      Kategorien, Tags, Medien, Benutzer und Rollen; Treffer mit
      farbiger Bereichs-Badge, Präfix-Suche ab 3 Zeichen, Dropdown
      öffnet erst bei Eingabe, permission-gefiltert pro Bereich
      (2026-08-06)
- [x] Content-Vorschau-Links (signierte, zeitlich begrenzte URLs) –
      `POST /content/:id/preview-links` erzeugt einen Token (SHA-256-
      gehasht gespeichert, gleiches Muster wie Refresh-/Verifikations-
      Tokens), öffentliche Seite `/preview/[token]` zeigt den Inhalt
      unabhängig vom Status ohne Login; Verwaltung (erstellen/auflisten/
      widerrufen) über einen neuen "Vorschau-Link"-Dialog im Content-
      Editor (2026-08-06)

### 2b.5 – Redaktionskomfort

- [ ] Globale Filter auf allen Listen (Status, Autor, Kategorie, Tags, Datum)
- [ ] Gespeicherte Filter ("Meine Entwürfe", "Geplante Beiträge")
- [ ] Frei konfigurierbare Tabellenansichten (Spalten ein-/ausblenden)
- [ ] Mehrfachbearbeitung (Status, Kategorien, Autor, Tags ändern)
- [ ] Favoriten / angeheftete Inhalte
- [ ] Zuletzt bearbeitete Inhalte
- [x] Autosave während der Bearbeitung – lokal im Browser
      (`localStorage`), debounced 1.5s nach Änderung, admin-abschaltbar
      über `Einstellungen → Zugriff & Funktionen → Autosave im
      Content-Editor` (2026-08-06)
- [x] Wiederherstellung nicht gespeicherter Entwürfe – Banner beim
      Öffnen eines Inhalts, falls ein neuerer lokaler Entwurf existiert
      (Wiederherstellen/Verwerfen) (2026-08-06)
- [ ] Keyboard-Shortcuts (Strg+S, Strg+K, Esc usw.)
- [ ] Command Palette (ähnlich VS Code)

### 2b.6 – SEO

- [x] SEO-Titel – eigener "SEO"-Tab im Content-Editor (2026-08-06)
- [x] Meta-Description (2026-08-06)
- [x] Canonical-URL (2026-08-06)
- [x] OpenGraph- und Twitter-Card-Einstellungen – OG-Titel/-Beschreibung/
      -Bild (per Medienbibliothek-Picker) + Twitter-Card-Typ
      (2026-08-06)
- [x] Robots-Attribute (index/noindex, follow/nofollow) – zwei Schalter,
      Default beide "erlaubt" (2026-08-06)
- [ ] XML-Sitemap automatisch erzeugen
- [ ] robots.txt verwalten
- [ ] SEO-Analyse mit Hinweisen
- [x] URL-Slug automatisch generieren – war bereits vorhanden
      (`slugify(title)`, solange der Slug nicht manuell angefasst wurde)
- [ ] Weiterleitungen (301/302)

### 2b.7 – Medienmanagement

- [ ] Bild zuschneiden
- [ ] Bildgrößen automatisch generieren
- [ ] WebP/AVIF-Konvertierung
- [ ] Fokuspunkt für Responsive Images
- [ ] Bildkompression
- [ ] EXIF-Daten entfernen
- [ ] PDF-, Video- und Office-Dateien in der Medienbibliothek hinzufügen, sowie im Seiteneditor auswählen und einbinden.
- [ ] PDF-, Video- und Office-Datei-Vorschau
- [ ] Mediensuche nach Dateityp, Größe und Tags
- [ ] Medien duplizieren
- [ ] Erkennung ungenutzter Medien

### 2b.8 – Content-Struktur

- [x] Navigationen verwalten – eigenständige `Navigation`/`NavigationItem`-
      Modelle, `/dashboard/navigation`, mehrere benannte Menüs mit
      beliebig tief verschachtelbaren Einträgen, die auf Inhalte oder
      externe URLs zeigen (2026-08-06)
- [ ] Seitenbaum / Parent-/Child-Seiten / URL-Hierarchien / Reihenfolge
      per Drag & Drop am Inhalt selbst / Startseite definieren –
      **bewusst nicht umgesetzt**: ein erster Versuch (`Content.parentId`/
      `sortOrder`/`path`, `/dashboard/content/tree`) wurde noch am
      selben Tag auf Nutzerwunsch wieder zurückgebaut, da die Trennung
      von Seitenbaum und Navigation nicht nachvollziehbar war – die
      Navigationsverwaltung deckt den eigentlichen Bedarf ("Seiten
      organisieren und verschachteln") vollständig ab. Details siehe
      [navigation-management.md](../knowledge-base/content/navigation-management.md)
      Abschnitt "Verworfener Ansatz".

#### Seiten-Designer (modul-basierter Drag&Drop-Editor)

Auf Nutzervorschlag (2026-08-06) statt eines einzelnen Rich-Text-Felds
pro Inhalt: Seiten werden aus einer geordneten Liste typisierter, per
Drag & Drop einfügbarer "Module" zusammengesetzt – vergleichbar mit
WordPress-Gutenberg, Storyblok oder Contentfuls "Modular Content". Jedes
Modul hat wie ein Content-Type ein eigenes JSON-Schema (Wiederverwendung
der bereits vorhandenen dynamischen Formular-Generierung aus
[content-editor-dynamic-forms.md](../knowledge-base/content/content-editor-dynamic-forms.md)).
Ersetzt die bisherigen, vageren Einzelpunkte "Inhaltsblöcke mehrfach
verwendbar", "Globaler Content (Footer, Header, Banner)" und
"Wiederverwendbare Komponenten" durch ein einziges, kohärentes
Feature-Konzept. Umgesetzt am 2026-08-07, dabei mehrfach am selben Tag
nachgeschärft (Liste → freies Canvas → Gutenberg-Block-Editor mit
zunächst versteckter, dann permanent sichtbarer Typ-Palette in einem
eigenen "Design"-Tab, ohne separates `body`-Rich-Text-Feld daneben →
echte Inhalts-Vorschau statt Formularfeldern im Block selbst → Fläche
komplett schreibgeschützt, Einfügen nur noch per Drag&Drop ohne
Klick-Fallback, jeder Bausteintyp mit Dummy-/Beispieldaten vorbefüllt,
Bearbeitung ausschließlich über ein Popup-Fenster → zuletzt kein
permanentes Icon/Name-Label mehr über dem Block (Steuerung nur bei
Hover), Umsortieren nur noch per Drag&Drop im Content statt Pfeilen,
plus Bugfix: öffentliche Vorschau-Seite rendert Bausteine jetzt
tatsächlich). Details siehe
[page-designer.md](../knowledge-base/content/page-designer.md).

- [x] Modul-Typen definieren (Backend) – neues `ModuleType`-Modell
      analog zu `ContentType.schema`: Name, Icon, Feldschema
- [x] Neuer Feldtyp "Module" in `ContentType.schema` – ein Content-Type
      bekommt ein Feld vom Typ "Modul-Liste" statt/zusätzlich zu einem
      reinen Rich-Text-Feld
- [x] Gutenberg-artiger Block-Editor mit eigenem "Design"-Tab – links
      permanent sichtbare, durchsuchbare Palette aller Modul-Typen
      (Icon+Name), Einfügen per Drag&Drop auf eine beliebige Position im
      Block-Flow (kein Klick-Fallback), direkt mit realistischem
      Dummy-Inhalt vorbefüllt (Lorem Ipsum, Platzhalterbild etc.). Die
      Fläche selbst zeigt **ausschließlich** den echten Inhalt (keine
      Icon/Name-Kopfzeile) – Bearbeiten/Entfernen erscheinen erst als
      schwebende Leiste bei Hover, Umsortieren per Drag&Drop direkt im
      Content (keine Pfeile). Jegliche Bearbeitung (Inhalt und
      Einstellungen) läuft über ein Popup-Fenster. Neuer Feldtyp "image"
      mit Klick-zu-Medienbibliothek statt roher URL-Eingabe, per
      Zieh-Griff frei skalierbar (15-100%), mit Ausrichtung (Keine/Volle
      Breite/Links/Zentriert/Rechts) – links/rechts floaten echt (CSS
      `float`), sodass Text bzw. andere, ebenfalls schmal eingestellte
      Bausteine (z.B. Zitat, per eigenem Block-Zieh-Griff) sich daneben
      einreihen statt in eigener Zeile darunter zu stehen.
- [ ] Basis-Modul-Bibliothek – bisher 5 von 8 geplanten Typen umgesetzt
      (Rich-Text, Bild, Bild+Text, CTA-Button, Zitat); noch offen:
      Trenner, Akkordeon/FAQ, Bildergalerie
- [ ] Globale Module – ein Modul lässt sich als "global" markieren
      (einmal pflegen, auf mehreren Seiten eingebunden – deckt Footer/
      Header/Banner und wiederverwendbare Inhaltsblöcke gleichzeitig ab,
      statt sie als separate Features zu bauen)
- [ ] Live-Vorschau der zusammengesetzten Seite – Integration mit den
      bestehenden Content-Vorschau-Links

### 2b.9 – Workflow

- [ ] Review-Workflow - simpel halten
- [ ] Freigabeprozesse - simpel halten
- [ ] Kommentare direkt am Inhalt
- [ ] Aufgaben zuweisen
- [ ] Änderungsanfragen
- [ ] Veröffentlichungs-Historie
- [ ] Benachrichtigungen
- [x] Sperren während Bearbeitung (Content Locking) – weiche Sperre
      (`Content.lockedById`/`lockedAt`), 2-Minuten-TTL mit
      Heartbeat-Verlängerung, Banner + schreibgeschütztes Formular bei
      Fremdsperre, Admin-Override (`content:delete`) (2026-08-06)
- [ ] Konfliktauflösung bei paralleler Bearbeitung – bewusst separat
      gelassen, siehe `knowledge-base/content/content-locking.md`

### 2b.10 – Formulare

- [ ] Formular-Builder
- [ ] Formular-Auswertungen
- [ ] CSV-Export
- [ ] Spam-Schutz (Captcha)
- [ ] E-Mail-Benachrichtigungen
- [ ] Webhook nach Formularversand
- [ ] Individuelle Validierungen

### 2b.11 – Dateien & Downloads

- [ ] Download-Center
- [ ] Dateiversionierung
- [ ] Ablaufdatum für Downloads
- [ ] Download-Statistiken
- [ ] Geschützte Downloads
- [ ] Einmal-Downloadlinks

### 2b.12 – Personalisierung

- [ ] Eigene Dashboard-Widgets
- [ ] Persönliche Startseite
- [ ] Favorisierte Menüpunkte
- [ ] Dashboard-Kacheln per Drag & Drop
- [ ] Individuelle Sprache pro Benutzer
- [ ] Individuelle Zeitzone

## Phase 3 – Plattform-Härtung

- [ ] CI/CD-Pipeline (Lint, Typecheck, Tests, Build, ggf. Turborepo Remote
      Cache)
- [ ] Echter Mail-Versand für Passwort-Reset/E-Mail-Verifikation (aktuell
      Dev-Stub, siehe Phase 2a), 2FA/TOTP
- [ ] Audit-Log tatsächlich befüllen (aktuell nur Datenmodell)
- [ ] Dark-Mode-Umschalter im Dashboard
- [ ] Redis-Anbindung für Caching/Sessions aktivieren
- [ ] API-Keys für externe Anwendungen
- [ ] Rate Limits pro API-Key
- [ ] API-Dokumentation pro Mandant
- [ ] Backups über das Dashboard
- [ ] Restore-Funktion
- [ ] Health-Checks
- [ ] Monitoring (Prometheus/OpenTelemetry)
- [ ] Performance-Dashboard
- [ ] Feature-Flags
- [ ] Systeminformationen
- [ ] Datenbank-Migrationsübersicht
- [ ] Wartungsmodus
- [ ] IP-Allowlist für das Backend
- [ ] Login-Verlauf
- [ ] Geräteverwaltung
- [ ] Session-Verwaltung (aktive Logins anzeigen und beenden)

## Phase 4 – Headless & Integrationen

- [ ] REST-API-Versionierung
- [ ] GraphQL Playground
- [ ] Webhook-Management im Dashboard
- [ ] API-Explorer
- [ ] OpenAPI-Client generieren
- [ ] Content Delivery API
- [ ] Preview API
- [ ] SDKs für JavaScript und .NET

### 4.1 – Entwicklerfreundlichkeit

- [ ] Eigene Feldtypen registrieren
- [ ] Eigene Editor-Komponenten
- [ ] Plugin-Marktplatz
- [ ] Hook-System
- [ ] Event-System
- [ ] CLI zum Erzeugen neuer Module
- [ ] Codegenerator für CRUD-Module
- [ ] Migrationen für Content-Schemas

### 4.2 – Enterprise

- [ ] Mandantenfähigkeit (Multi-Tenant)
- [ ] Content-Staging
- [ ] Veröffentlichungs-Pipelines
- [ ] Mehrstufige Freigaben
- [ ] LDAP/Active Directory
- [ ] SAML
- [ ] Azure AD Login
- [ ] Organisationsverwaltung
- [ ] Datenexport (DSGVO)
- [ ] Aufbewahrungsrichtlinien
- [ ] Archivierung
- [ ] Mehrsprachigkeit vollständig (Locale-Switching in UI, Fallback-Ketten)

### 4.3 – Analytics

- [ ] Dashboard mit CMS-Kennzahlen
- [ ] Beliebteste Inhalte
- [ ] Meistgesuchte Begriffe
- [ ] Inhaltsalter anzeigen
- [ ] Broken-Link-Erkennung
- [ ] Verwaiste Seiten erkennen
- [ ] Duplicate-Content-Erkennung
- [ ] Lesbarkeitsanalyse
- [ ] Interne Linkvorschläge

## Priorisierungsprinzip

Reihenfolge orientiert sich daran, was ein Redaktionsteam für den täglichen
Betrieb zuerst braucht (Login → Inhalte anlegen/bearbeiten → Medien →
Suche/Vorschau), bevor Skalierungs- und Enterprise-Themen (SSO, Multi-Tenant,
GraphQL) angegangen werden. Die Reihenfolge kann jederzeit an neue
Anforderungen angepasst werden – dann bitte auch hier aktualisieren.

### Empfohlene Top-10-Priorisierung (nächste Schritte)

Wenn das Ziel ein modernes CMS ähnlich Strapi, Directus oder Payload CMS
ist, sollten diese zehn Funktionen aus den obigen Phasen zuerst angegangen
werden – sie erhöhen den praktischen Nutzen für Redakteure am stärksten und
schaffen gleichzeitig die Grundlage für die späteren Enterprise-Features:

1. ~~Volltextsuche (2b.4)~~ ✅ 2026-08-06
2. ~~Navigationsverwaltung (2b.8)~~ ✅ 2026-08-06 (Seitenbaum-Teil bewusst nicht umgesetzt, siehe 2b.8)
3. ~~SEO-Verwaltung (2b.6)~~ ✅ 2026-08-06
4. ~~Autosave (2b.5)~~ ✅ 2026-08-06
5. ~~Content Locking (2b.9)~~ ✅ 2026-08-06
6. Workflow/Freigaben (2b.9)
7. ~~Seiten-Designer – freiflächiges Drag&Drop-Canvas (2b.8)~~ ✅ 2026-08-07 (Basis-Modul-Bibliothek, globale Module, Live-Vorschau-Integration noch offen)
8. Bildoptimierung – WebP/AVIF (2b.7)
9. API-Keys für externe Anwendungen (Phase 3)
10. Dashboard mit Statistiken (4.3)
