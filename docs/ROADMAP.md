# Roadmap – pivot CMS

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
- [ ] Keyboard-Shortcuts (Strg+S, Strg+K, Esc usw.) – Strg+K/Esc bereits
      über die Command Palette abgedeckt, Strg+S usw. weiterhin offen
- [x] Command Palette (ähnlich VS Code) – globaler Strg/Cmd+K-Shortcut
      öffnet ein Overlay mit drei Bereichen: Schnellaktionen (Neuer
      Inhalt, Konto, Einstellungen, Abmelden), permission-gefilterte
      Navigation (dieselbe Quelle wie die Sidebar) und Live-Suche
      (wiederverwendet den bestehenden `/search`-Endpoint aus 2b.4),
      Tastatur-Navigation per Pfeiltasten/Enter, Substring-Filter der
      statischen Einträge während der Eingabe (2026-08-09)

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

- [x] Bild zuschneiden – erzeugt bewusst ein neues, eigenständiges Medium
      statt das Original zu überschreiben (2026-08-08)
- [x] Bildgrößen automatisch generieren – WebP/AVIF-Varianten bei festen
      Breakpoints (320/640/1024/1920px), admin-abschaltbar über
      `Einstellungen → Zugriff & Funktionen → Automatische Bildvarianten`
      (2026-08-08)
- [x] WebP/AVIF-Konvertierung (2026-08-08)
- [x] Fokuspunkt für Responsive Images – wirkt auf künftig generierte
      Varianten/Zuschnitte (2026-08-08)
- [x] Bildkompression – Re-Encoding beim Upload-Normalisieren (2026-08-08)
- [x] EXIF-Daten entfernen (2026-08-08)
- [x] PDF-, Video- und Office-Dateien in der Medienbibliothek hinzufügen,
      sowie im Seiteneditor auswählen und einbinden – Rich-Text-Toolbar
      "Datei einfügen" (2026-08-08)
- [x] PDF-, Video- und Office-Datei-Vorschau – leichtgewichtig/nativ
      (`<iframe>`/`<video>`/Icon+Download-Link, kein ffmpeg/LibreOffice)
      (2026-08-08)
- [x] Mediensuche nach Dateityp, Größe und Tags – Medien-Tags nutzen den
      bestehenden, gemeinsamen Tag-Pool (2026-08-08)
- [x] Medien duplizieren (2026-08-08)
- [x] Erkennung ungenutzter Medien – On-Demand-Scan, keine automatische
      Löschung (2026-08-08)

### 2b.8 – Content-Struktur

- [x] Navigationen verwalten – eigenständige `Navigation`/`NavigationItem`-
      Modelle, `/dashboard/navigation`, mehrere benannte Menüs mit
      beliebig tief verschachtelbaren Einträgen, die auf Inhalte oder
      externe URLs zeigen (2026-08-06)

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
- [x] Basis-Modul-Bibliothek – jetzt alle 8 geplanten Typen umgesetzt
      (Rich-Text, Bild, Bild+Text, CTA-Button, Zitat, Trenner, Akkordeon/
      FAQ, Bildergalerie). Trenner/FAQ/Galerie brachten einen neuen
      Feldtyp `"repeater"` (variable Anzahl Unterfeld-Gruppen pro Eintrag,
      Hinzufügen/Auf/Ab/Entfernen im Bearbeiten-Popup) – FAQ rendert als
      natives `<details>`-Akkordeon, Galerie als Bild-Raster mit
      Fokuspunkt-Unterstützung; beides über Formerkennung (Repeater mit
      bzw. ohne Bild-Unterfeld) statt Modul-Slug unterschieden, analog zum
      bestehenden "Kacheln"-Muster. Trenner braucht gar kein Feld (leeres
      Schema), erkannt über "Modul ohne sichtbares Feld". (2026-08-09)
- [x] Globale Module – neues `GlobalModule`-Modell, per Fremdschlüssel aus
      einer Modul-Instanz referenziert (`globalModuleId`) statt als
      Snapshot in der Content-JSON gespeichert, Werte werden bei jedem
      Request live aufgelöst – Muster von der bestehenden
      Navigation→Content-Referenz übernommen statt vom (bewusst
      snapshot-basierten) `ImageFieldValue`. Eigene Verwaltungsseite
      (`/dashboard/global-modules`, Sidebar unter "Erweiterungen"), im
      Seiten-Designer per Drag&Drop aus eigenem Paletten-Abschnitt
      einbindbar. Bewusst nur zentral bearbeitbar (auf der Seite selbst
      nur einfüg-/entfernbar, schreibgeschützt mit "Global"-Badge) –
      vermeidet zwei parallele Speicherwege im selben Formular.
      (2026-08-09)
- [x] Live-Vorschau der zusammengesetzten Seite – "Vorschau öffnen"-
      Button im Content-Editor (nur beim Bearbeiten bestehender Inhalte)
      sowie ein Vorschau-Icon direkt in der Inhalte-Liste: erstellt im
      Hintergrund einen kurzlebigen Vorschau-Link über den bestehenden
      Endpoint (`POST /content/:id/preview-links`) und öffnet ihn sofort
      in neuem Tab, statt manuell über den Vorschau-Link-Dialog zu gehen.
      (2026-08-09)

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

- [x] Formular-Builder (`/dashboard/forms`, eigener Seiten-Designer-
      Baustein, Mailing-Integration – siehe
      `knowledge-base/content/forms.md`, 2026-08-23)
- [ ] Formular-Auswertungen (Abschlussrate/Analytics bewusst
      zurückgestellt, siehe forms.md "Bewusst nicht gebaut")
- [ ] CSV-Export (Einsendungen)
- [ ] Spam-Schutz (Captcha) – aktuell nur der app-weite `ThrottlerGuard`
- [x] E-Mail-Benachrichtigungen (Admin-Benachrichtigung + Bestätigung an
      Absender, über Mailing verwaltbar, 2026-08-23)
- [ ] Webhook nach Formularversand
- [ ] Individuelle Validierungen (über Pflichtfeld hinaus)
- [ ] Datei-Upload-Feldtyp (Katalog vorhanden, kein Upload-Handling)

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

### 2b.13 – Rollen & Rechte: granulare Rechte + visuelles Redesign

Mehrsitzungs-Vorhaben (Nutzerhinweis, 2026-08-16: "das sind große Änderungen
über mehrere Sessions"). Ziel: die bisherige einfache Tabelle + Anlegen/
Bearbeiten-Dialog (`/dashboard/roles`) durch eine Split-View-Seite ersetzen,
nach vorliegender Bildvorlage (Rollen-Liste links, Detail-Panel rechts mit
Umfang-Anzeige, Kategorie-Tabs, Rechte-Karten pro Ressource) – analog zum
bereits umgesetzten Muster bei Medien (Masonry + Detail-Panel) und
Navigation (Menü-Liste + Einträge-Panel, siehe
[navigation-management.md](../knowledge-base/content/navigation-management.md)).

**Bereits umgesetzt (2026-08-16):**
- [x] Backend-Rechte-Katalog von 13 groben Bundle-Rechten auf 46
      feingranulare Rechte aufgesplittet (`content:publish`/`schedule`,
      eigene `navigation`/`webhooks`/`gallery`/`faq`/`preview-links`-
      Ressourcen, `users`/`roles`/`settings` in einzelne Aktionen
      aufgesplittet) + Kategorisierung (Kern/Erweiterungen/Verwaltung) für
      die UI-Gruppierung. 7 Beispielrollen (Administrator, Chefredaktion,
      Redakteur, Autor, Medienpflege, Formular-Manager, Gast/Praktikum)
      nach Bildvorlage geseedet. Details:
      [rbac-rework.md](../knowledge-base/auth/rbac-rework.md).
- [x] `DELETE /users/:id` von Hard-Delete auf Soft-Delete (`isActive`)
      umgestellt, inkl. Refresh-Token-Widerruf.

**Bewusst zurückgestellt** (Nutzervorgabe, 2026-08-16: "Formular und
Systembenachrichtigungen nicht beachten, das kommt später"): Rechte-Karten
für **Formulare** (Modul existiert noch nicht, siehe 2b.10),
**Systemnachrichten** und **Websites/Multi-Site** (beide ohne eigene
Rechte-Ressource im Backend) werden in der neuen Seite vorerst NICHT
angezeigt – nur die 13 real existierenden Ressourcen (Seiten, Medien,
Kategorien, Tags, Menüs, Bausteine, Galerien, FAQs, Vorschau-Links,
Webhooks, Benutzer, Rollen & Rechte, Einstellungen). Nachziehen, sobald die
jeweiligen Module selbst gebaut sind.

**Visuelles Redesign umgesetzt (2026-08-16):**
- [x] Seite `/dashboard/roles` auf Split-View umgestellt (`?role=<id>`-
      URL-Pattern wie bei `/dashboard/navigation?menu=`, akzeptiert
      zusätzlich `?highlight=` von der globalen Suche): links Rollen-Liste
      (Name, Nutzeranzahl, Rechteanzahl bzw. "alle Rechte" bei
      Administrator, "kein Login" bei `canAccessDashboard=false`), rechts
      Detail-Panel. Neue Komponente `roles-explorer.tsx`.
- [x] Detail-Panel: Beschreibung (Textarea) + "Zugriff auf das Backend"
      (Switch) + Rechte-Checkboxen als EIN gemeinsames Formular mit
      Dirty-State-Tracking, "Zurücksetzen"/"Rechte speichern" (Rollenname
      bleibt reine Anzeige, kein Inline-Rename – Anlegen weiterhin über
      den bestehenden `RoleFormDialog`)
- [x] "Umfang"-Bereich: Fortschrittsbalken (vergeben/verfügbar),
      Schreibrechte-Anzahl (Aktionen ≠ `read`), Nutzeranzahl, "Zuletzt
      geändert" (`Role.updatedAt` jetzt in `serializeRole()` ergänzt)
- [x] Kategorie-Tabs (Alle/Kern/Erweiterungen/Verwaltung, mit echten
      Trefferzahlen aus dem Katalog) + "Nur vergebene Rechte"-Filter
- [x] Rechte-Karten pro Ressource: Icon, "X/Y Rechte", Quick-Toggle
      "Alle"/"Keine" (abhängig vom aktuellen Auswahlstatus), Checkboxen
      gruppiert. Labels/Icons in `lib/permission-labels.ts` zentralisiert
      (vorher in `role-form-dialog.tsx` dupliziert)
- [x] "Rechte exportieren" (Button im Seitenkopf, Client-seitiger
      JSON-Download aller Rollen+Rechte, kein Backend-Endpoint nötig)
- [x] "Rolle duplizieren" (Quick-Action unten in der Rollen-Liste, legt
      Kopie der aktuell gewählten Rolle an und springt direkt dorthin)
- [x] Administrator-Rolle in der neuen UI schreibgeschützt (Lock-Icon,
      "Geschützt"-Badge, alle Eingaben disabled) – rein clientseitiger
      Schutz vor versehentlicher Selbstaussperrung, das Backend erlaubt
      technisch weiterhin das Ändern (kein neues Risiko, nur UX-Schutz)
- [x] Alte Komponenten entfernt: `roles-table.tsx`, `role-row-actions.tsx`

**Noch offen / nicht verifiziert:**
- [ ] Echter Browser-/visueller Abgleich gegen die Bildvorlage (bisher nur
      per SSR-HTML-Inspektion über `curl` verifiziert – kein Playwright/
      Chromium in diesem Projekt verfügbar, kein Screenshot gemacht).
      Feinschliff bei Abständen/Farben/Icon-Auswahl wahrscheinlich nötig.
- [ ] Mobile/schmale Viewports der neuen Split-View ungetestet
- [ ] Formulare/Systemnachrichten/Websites-Karten nachziehen, sobald die
      jeweiligen Module existieren (siehe oben)

### 2b.14 – Benutzer bearbeiten: volle Profilseite statt Dialog

Neues Mehrsitzungs-Vorhaben (Nutzervorgabe, 2026-08-16, 1:1 nach
Bildvorlage): der Stift in der Benutzer-Tabelle öffnet künftig eine eigene
Seite (`/dashboard/users/[id]/edit`, Breadcrumb "Dashboard > Verwaltung >
Benutzer > Bearbeiten") statt des bisherigen `EditUserDialog`-Popups – mit
Tabs "Profil" / "Zugang & Sicherheit" / "Aktivität".

**Bewusst nicht gebaut** (Nutzervorgabe): Website-Zugriff-Sektion (kein
Multi-Site-Konzept vorhanden), Benachrichtigungen-Sektion (kein
Notification-System vorhanden), "Anmeldung nur aus Firmennetz"
(IP-Range-Login-Beschränkung). "Aktivität"-Tab vorerst nur als TODO
vormerken, nicht umsetzen.

**Größte Architektur-Entscheidung: Mehrfach-Rollen – umgesetzt (2026-08-16).**
Nutzervorgabe: "Benutzer dürfen mehrere Rollen haben" – `User.roleId` war
eine einzelne Pflicht-FK (`User` → `Role`, 1:n). Dafür jetzt eine n:m-
Tabelle (`UserRole`, analog zu `RolePermission`). Umgesetzt:
- Schema-Migration + Backfill (jeder bestehende `roleId`-Wert wurde zur
  ersten `UserRole`-Zeile; additiver Push, SQL-Backfill, dann `roleId`-
  Spalte entfernt – kein Datenverlust)
- `AuthService.issueTokens()`: `permissions` im JWT ist jetzt die
  Vereinigung aller Rechte über alle Rollen des Nutzers;
  `canAccessDashboard` = mind. eine Rolle erlaubt es
- JWT-Payload trägt `roleIds`/`roleNames` als Arrays (statt Singular
  `roleId`/`roleName`) – alle Frontend-Stellen, die `user.role.name`
  lasen (Nutzer-Tabelle, `no-dashboard-access.tsx`), lesen jetzt
  `user.roles: {id,name}[]`; `isAdministrator`-Checks in
  `roles-explorer.tsx` betreffen die Rollen-Entität selbst, nicht den
  eingeloggten Nutzer, unverändert
- `RolesService.remove()` (Rolle löschen, wenn `userCount === 0`) und
  `UsersService.findAll({roleId})`-Filter auf die neue n:m-Beziehung
  umgestellt (`userRoles: { some: { roleId } }`)
- Seed, `CreateUserDto`/`UpdateUserDto` (`roleId` → `roleIds: string[]`)
  umgestellt; `CreateUserDialog`/`EditUserDialog` senden vorerst weiter
  nur eine einzelne gewählte Rolle als 1-Element-Array – ein echter
  Mehrfach-Rollen-Picker kommt erst mit der neuen Profilseite unten

**Weitere neue Felder/Konzepte, die für die Vorlage fehlen:**
- `User.department`, `User.phone` (Stammdaten-Felder "Abteilung"/"Telefon")
- Fehlgeschlagene Login-Versuche zählen (`AUTHENTICATION` – "Fehlversuche"
  im "Konto"-Kasten) – neues Feld + Reset bei erfolgreichem Login
- "Passwortwechsel bei nächster Anmeldung erzwingen" – neues
  `mustChangePassword`-Flag, beim nächsten Login durchsetzen
- "Aktive Sitzungen" mit Gerät/Browser/Ort + einzeln/gesammelt abmelden:
  `RefreshToken` müsste dafür Geräte-Metadaten (User-Agent-Parsing) und
  optional IP-Geolocation mitschreiben – aktuell nur Token-Hash +
  Ablaufzeit. "Abmelden" pro Zeile = gezielt eine `RefreshToken`-Zeile
  widerrufen, "Alle anderen Sitzungen beenden" = alle außer der
  aktuellen widerrufen (ähnlich `AuthService.changePassword()`s
  `revokeAllRefreshTokens`, aber mit Ausnahme der eigenen Sitzung)
- 2FA-Toggle in "Anmeldung": UI-Element schon mit vorsehen, Funktion
  bleibt Platzhalter bis zur separat geplanten echten 2FA-Umsetzung
  (siehe 2b.13-Notiz zur "2FA"-Spalte in der Benutzer-Tabelle)
**Geklärt (Nutzerentscheidung 2026-08-16) – drei zuvor offene Punkte:**

- **"Benutzer löschen" = Anonymisierung, kein Hard-Delete.** Bestehende
  Deaktivierung (`UsersService.remove()`, nur `isActive: false`,
  reversibel über den Bearbeiten-Dialog) bleibt unverändert die schnelle
  "Sperren"-Aktion aus der Tabellenzeile/dem Kopfbereich der neuen Seite.
  "Benutzer löschen" (roter Button unten auf der neuen Seite) ist eine
  **zweite, separate, nicht umkehrbare** Aktion:
  - Neue Methode `UsersService.anonymize(id, currentUserId)` (eigener
    Endpunkt `POST /users/:id/anonymize`, eigene Berechtigung
    `users:delete` – bewusst restriktiver als `users:deactivate`, damit
    diese stärkere Aktion separat vergeben werden kann)
  - Setzt `email` auf eindeutigen Platzhalter (`deleted-<id>@anonymized.local`,
    wegen Unique-Constraint), `firstName`/`lastName` auf "Gelöschter
    Nutzer", `avatarUrl` auf `null`, `passwordHash` auf einen
    zufälligen, nicht einlösbaren Wert (Login danach unmöglich),
    `isActive: false`, künftige `department`/`phone`-Felder auf `null`
  - Neues Feld `User.anonymizedAt DateTime?` – markiert den Zustand
    eindeutig (unterscheidet "anonymisiert" von normalem "deaktiviert"),
    UI blendet dann Bearbeiten-Optionen aus und zeigt "Gelöschter
    Nutzer" statt echtem Namen
  - `id` und die Zeile selbst bleiben erhalten (keine `contents_authorId_fkey`-
    Verletzung, siehe [rbac-rework.md](../knowledge-base/auth/rbac-rework.md))
    – nur alle personenbezogenen Daten sind entfernt
  - Refresh-Tokens werden widerrufen (wie beim bestehenden `remove()`)
  - Frontend: harte Bestätigung nötig (z.B. Namen eintippen), da nicht
    reversibel
- **"Konto entfernen"** (Sektion im Bild) nutzt **dieselbe
  Anonymisierungs-Aktion** wie oben – kein separates Konzept mit
  Inhalts-Reassignment auf einen "Ehemaliger Mitarbeiter"-Platzhalter-
  Nutzer. Ein Button/eine Aktion für beide Stellen der Vorlage.
- **"Als Nutzer ansehen" (Admin-Impersonation): wird gebaut**,
  Sicherheitsdesign liegt nach Nutzervorgabe ("mach es so, wie du es für
  richtig und sicher hältst") in eigenem Ermessen:
  - Neuer Endpunkt `POST /users/:id/impersonate` (Berechtigung
    `users:impersonate`, nur für Administrator-Rolle), gibt einen
    kurzlebigen Access-Token (z.B. 15 Min., **kein** Refresh-Token) mit
    den Rechten des Zielnutzers zurück, JWT-Payload erhält zusätzliches
    Feld `impersonatedBy: <adminUserId>`
  - Zielnutzer darf nicht selbst Administrator sein und nicht der
    eigene Account (keine Rechte-Ketten/Privilege-Loops)
  - Audit-Log-Eintrag (Tabelle existiert bereits, `AuditLog`/
    `audit_logs`) bei Start der Impersonation: `action:
    "user.impersonate"`, `userId: <adminUserId>`, `entityType: "User"`,
    `entityId: <targetUserId>`
  - Frontend: durchgängig sichtbarer Banner "Du siehst als X – Zurück zu
    deinem Konto", eigenes Konto bleibt während der Impersonation separat
    im Storage gehalten (nicht überschrieben) und wird beim Verlassen
    wiederhergestellt

**Zusätzlich aufgenommen (Nutzervorgabe 2026-08-16):** echte 2FA-Funktion
bleibt weiterhin ein **eigenes, späteres Vorhaben** (siehe Phase 3,
"2FA/TOTP") – wird hier nicht mit umgesetzt. Der Toggle im Tab "Zugang &
Sicherheit" wird aber **jetzt schon als UI-Platzhalter** (Switch,
deaktiviert/ohne Funktion) mitgebaut, damit die Fläche vorhanden ist,
sobald die echte Umsetzung folgt – konsistent mit der bereits
platzierten "2FA"-Spalte in der Benutzer-Tabelle.

**Aufgabenliste (Umsetzung):**
- [x] Schema: `UserRole`-n:m-Tabelle + Migration/Backfill (2026-08-16,
      additiver Push → SQL-Backfill aus altem `roleId` → `roleId`-Spalte
      entfernt; siehe [rbac-rework.md](../knowledge-base/auth/rbac-rework.md))
- [x] Schema: `department`, `phone`, `mustChangePassword`,
      Fehlversuche-Zähler (`failedLoginAttempts`), `anonymizedAt`,
      `pendingActivation` auf `User` (2026-08-16)
- [x] Backend: `AuthService`/`UsersService`/`RolesService` auf
      Mehrfach-Rollen umgestellt (2026-08-16): JWT trägt `roleIds`/
      `roleNames`-Arrays, Rechte-Vereinigung über alle Rollen,
      `canAccessDashboard` = mind. eine Rolle erlaubt es;
      `CreateUserDto`/`UpdateUserDto` nutzen `roleIds: string[]`
- [x] Backend: Sitzungs-Endpoints (2026-08-16) – `GET/DELETE
      /users/:id/sessions`, `POST /users/:id/sessions/revoke-others`,
      `RefreshToken.userAgent`/`ipAddress`, `summarizeUserAgent()`
- [x] Backend: `PATCH /users/:id` um `department`/`phone`/`roleIds`/
      `mustChangePassword` erweitert (2026-08-16)
- [x] Frontend: neue Route `/dashboard/users/[id]/edit`, ersetzt
      `EditUserDialog` als primären Bearbeiten-Weg (`EditUserDialog`
      gelöscht, 2026-08-16)
- [x] Frontend: Tab "Profil" (Stammdaten, Mehrfach-Rollen-Checkboxen,
      OHNE Website-Zugriff-Sektion) (2026-08-16)
- [x] Frontend: Tab "Zugang & Sicherheit" (Anmeldung-Sektion ohne
      Firmennetz-Option, Aktive-Sitzungen-Liste mit Pagination,
      Konto-Info-Kasten) (2026-08-16)
- [x] Frontend: Tab "Aktivität" – echte, serverseitig paginierte
      Zeitleiste statt Platzhalter (2026-08-17, Nachtrag): neuer globaler
      `AuditLogService` (`apps/api/src/audit-log/`, gleiches
      `@Global()`-Muster wie `CacheService`), `GET /users/:id/activity`
      (nutzt `PaginationControls` im `onPageChange`-Modus, echtes
      `skip`/`take` statt Alles-laden-und-schneiden). Erfasste Ereignisse:
      `user.created`, `user.role_changed`, `user.password_changed`,
      `user.2fa_enabled`/`2fa_disabled`, `user.impersonate` (Bestandsfeature,
      jetzt auch in der Zeitleiste sichtbar), `media.uploaded`,
      `content.published`. **Bewusst nicht wie in der Bildvorlage
      gebaut:** kein "Formular veröffentlicht"-Eintrag (kein Formular-Modul
      in dieser App, siehe `UsersService.getStats()`-Kommentar), "Einladung
      angenommen" durch den tatsächlichen Erstellungsweg ersetzt
      (Admin-angelegt vs. Selbstregistrierung); Medien-Uploads erscheinen
      als einzelne echte Einträge, nicht als erfundene Sammelzahl wie
      "12 Medien hochgeladen". Siehe
      [user-activity-log.md](../knowledge-base/auth/user-activity-log.md).

      **Laufende Konvention (Nutzervorgabe 2026-08-17):** jede künftige
      Aktion, die für einen Nutzer relevant ist (neue Sicherheits-Funktion,
      neue Content-/Medien-Aktion, neue Admin-Aktion an einem Konto),
      bekommt beim Bauen einen passenden `AuditLogService.record()`-Aufruf
      UND einen zugehörigen Fall in
      `apps/web/src/components/user-activity-timeline.tsx`s
      `describeActivity()` – die Zeitleiste soll nicht stillschweigend
      hinter neuen Features zurückbleiben. Bei jedem neuen Feature mit
      einer nutzerbezogenen Aktion kurz prüfen, ob es hier reingehört.
- [x] Frontend: 2FA-Toggle im Tab "Zugang & Sicherheit" als deaktivierter
      Platzhalter-Switch (2026-08-16; echte Umsetzung folgt separat in
      Phase 3) – Aus-Farbe wurde global für alle Switches vereinheitlicht
- [x] Backend: `UsersService.anonymize()` + `POST /users/:id/anonymize`
      + Berechtigung `users:delete` (2026-08-16)
- [x] Backend: `POST /users/:id/impersonate` + Berechtigung
      `users:impersonate` + Audit-Log-Eintrag (2026-08-16)
- [x] Frontend: "Benutzer löschen"-Bestätigungsdialog (2026-08-16) –
      nutzt die bestehende `ConfirmDeleteDialog`-Konvention mit klarem
      Warntext statt eines Namens-Eintipp-Feldes (kein neues UI-Muster
      nur für diese eine Aktion); "Als Nutzer ansehen"-Banner mit
      sicherem Zurückwechseln (`ImpersonationBanner`,
      `admin_access_token`/`admin_refresh_token`-Cookie-Sicherung)
- [x] `EditUserDialog`-Reste aufgeräumt (Datei gelöscht, 2026-08-16)
- [x] Nutzerbezogene Systembenachrichtigungen (2026-08-16, zusätzlich zur
      ursprünglichen Liste): wartende Freischaltungen/auffällige
      Fehlversuche/anstehende Passwortwechsel als Glocke-Kategorien, alle
      Kategorien einzeln ab-/anschaltbar, App-weiter `CacheService` +
      DB-Indizes für die zugehörigen Abfragen (siehe
      [backend-caching.md](../knowledge-base/tooling/backend-caching.md))

## Phase 3 – Plattform-Härtung

- [ ] CI/CD-Pipeline (Lint, Typecheck, Tests, Build, ggf. Turborepo Remote
      Cache)
- [ ] Echter E-Mail-Versand – siehe 3.1 unten (eigener Abschnitt, da
      inzwischen 7 verdrahtete Auslöser + 2 UI-Platzhalter davon
      abhängen)
- [x] 2FA/TOTP (2026-08-17) – Self-Service-Einrichtung (QR-Code,
      Recovery-Codes), optionale Erzwingung für Administrator-Konten,
      globaler An/Aus-Schalter unter Einstellungen → Sicherheit. Löst den
      Platzhalter-Switch (siehe 2b.14-Eintrag oben) und die
      Platzhalter-Spalte in der Benutzertabelle ein. Details:
      [two-factor-authentication.md](../knowledge-base/auth/two-factor-authentication.md)

### 3.1 – Echter E-Mail-Versand (SMTP)

**Update 2026-08-22: größtenteils umgesetzt.** Nutzervorgabe "lass uns
jetzt email versand bauen unter einstellungen und integration die
settings dafür als dienst". Details siehe
[settings-page-redesign.md](../knowledge-base/frontend/settings-page-redesign.md)
(Integrationen/Dienste-Karte) und
[toast-and-system-messages.md](../knowledge-base/frontend/toast-and-system-messages.md)
(Benachrichtigungsempfänger). Ursprünglicher Bestand (2026-08-19): 11
bereits verdrahtete Mail-Auslöser + 2 UI-Platzhalter ohne Backend-Aufruf.

- [x] Konfiguration (Host/Port/User/Passwort/Absenderadresse/
      Verschlüsselung) über `AppSettings`, UI unter Einstellungen →
      Integrationen → Dienste (nicht wie ursprünglich geplant unter
      Benachrichtigungen – dortiger Platzhalter wurde stattdessen
      entfernt). Provider-Entscheidung fiel auf reines SMTP gegen einen
      vom Kunden vorgegebenen Mailserver (z.B. web.de) statt einen
      Relay-Dienst wie Postmark/SendGrid anzubinden – passend zu einem
      einzelnen, vom Kunden selbst betriebenen Postausgang.
- [x] `MailerService` von Logger-Stub auf echten Versand umgestellt
      (`nodemailer`), inkl. Fehlerbehandlung (Try/Catch + Server-Log).
      **Nicht umgesetzt:** ein Zustellfehler ist weiterhin nur im
      Server-Log sichtbar, nicht als `SystemMessage`-Hinweis im
      Dashboard (ursprünglich mitgeplant) – einzige Ausnahme: der neue
      "Jobs"-Reiter kann bei einem fehlgeschlagenen Job-Lauf an den
      Benachrichtigungsempfänger mailen, siehe
      [scheduled-jobs-tab.md](../knowledge-base/tooling/scheduled-jobs-tab.md),
      das deckt aber nicht alle 11 Mail-Auslöser ab.
- [x] Test-Versand-Button ("Testmail senden" im SMTP-Einrichten-Dialog,
      Zieladresse frei wählbar – nach einem Bugreport korrigiert, ging
      anfangs fälschlich immer an die Konto-Adresse des Pivot-Nutzers
      statt an eine echte, vom Nutzer kontrollierte Adresse).
- [x] **Update 2026-08-23: Betreff+Text jeder System-Mail sind jetzt über
      Einstellungen → Mailing editierbar** (siehe
      [forms.md](../knowledge-base/content/forms.md)) – Platzhalter-Chips,
      Testmail-Versand, Vorschau, "Auf Standard zurücksetzen", pro Vorlage
      ein "Versand aktiv"-Schalter. **Weiterhin kein HTML-Layout** (reiner
      Text wie bisher, nur jetzt anpassbar statt hart codiert) – "echte
      HTML-Vorlagen" im ursprünglichen Sinn (Layout/Branding) bleibt offen,
      siehe Bounce-Punkt unten. Zwei Auslöser bekamen bewusst KEINE Vorlage
      (`sendDeletionRequestFollowUp`: Admin tippt frei, kein Standardtext;
      `sendSystemNotificationEmail`: Text kommt bereits fertig aus
      `NotificationsService`).
- [x] Alle 11 Auslöser verschicken jetzt echte Mails (CSV-Berichte gehen
      als Anhang statt nur als Zeilenzahl im Text):
  - [x] Konto-Verifikation nach Registrierung (`sendVerificationEmail`)
  - [x] Passwort-Reset, öffentliches Self-Service-Formular
        (`sendPasswordResetEmail` über `requestPasswordReset()`)
  - [x] Passwort-Reset, Admin-ausgelöst (`adminRequestPasswordReset()`
        → `sendPasswordResetEmail`)
  - [x] Benutzer einladen (läuft über denselben
        Admin-Passwort-Reset-Mechanismus wie oben)
  - [x] DSB-Vorfall-Benachrichtigung (`sendDpoIncidentNotification`)
  - [x] DSB-Monatsbericht (`sendDpoMonthlyReport`, jetzt über den
        "Jobs"-Reiter editierbar statt festem Cron, siehe
        [scheduled-jobs-tab.md](../knowledge-base/tooling/scheduled-jobs-tab.md))
  - [x] Auskunft nach Art. 15 DSGVO – Button "Auskunft senden"
        (`sendSubjectAccessReport`; Bugfix am selben Tag: Button zeigte
        immer "Erfolg" an, auch wenn der Versand fehlschlug)
  - [x] Betroffenenanfragen-Log: Eingangsbestätigung
        (`sendDeletionRequestAcknowledgement`)
  - [x] Betroffenenanfragen-Log: Rückfrage an Absender
        (`sendDeletionRequestFollowUp`; gleicher Bugfix wie bei
        "Auskunft senden" – zeigte ebenfalls immer "Erfolg")
  - [x] Betroffenenanfragen-Log: Fristerinnerung an den DSB
        (`sendDeletionRequestDeadlineReminder`, jetzt über den
        "Jobs"-Reiter editierbar statt festem Cron)
  - [x] Auftragsverarbeiter-Tab: "AV-Vertrag anfordern"
        (`sendDataProcessorContractRequest`)
- [ ] Bounce-/Zustellfehler zumindest protokollieren (weiterhin nicht
      umgesetzt)

**Zusätzlich, selbiger Tag: Systembenachrichtigungen können jetzt
ebenfalls mailen** (war ursprünglich nicht Teil dieses Punkts) – neues
Feld `notificationRecipientEmail`, eine gemeinsame Adresse für alle
`notify*`-Kategorien (Wartungsmodus, Speicherplatz, Webhooks, ...),
Versand sofort bei jedem neuen Vorfall. Siehe
[toast-and-system-messages.md](../knowledge-base/frontend/toast-and-system-messages.md).

**Weiterhin offen, nicht Teil dieser Runde:** "Mein Konto" → Tab
"Benachrichtigungen" (pro Nutzer, Opt-in/-out pro Ereignistyp) – das
oben gebaute `notificationRecipientEmail` ist eine EINZELNE, geteilte
Admin-Adresse für Systembenachrichtigungen, kein Ersatz für ein
per-Nutzer-Präferenzmodell. Der Platzhaltertext in `my-account-view.tsx`
(~Z. 334-341) besteht unverändert fort.

**Zusätzlich: zwei UI-Bereiche, die E-Mail-Funktionen ankündigen, aber
noch nicht einmal einen Backend-Aufruf haben** (brauchen also nicht nur
SMTP-Anbindung, sondern erst noch eigene Datenmodelle/Logik obendrauf –
per vollständiger Frontend-Suche gefunden, 2026-08-19):

- [ ] Einstellungen → "Benachrichtigungen" (System-Absender):
      `settings-form.tsx` (Nav-Eintrag ~Z. 116-119, Inhalt ~Z. 1037-1041)
      – reine `PlaceholderCard` mit Text "Ein eigener Mail-Absender und
      der Versand von Systemmails sind in Vorbereitung...". Braucht ein
      UI für die oben genannte SMTP-Konfiguration.
- [ ] "Mein Konto" → Tab "Benachrichtigungen" (pro Nutzer):
      `my-account-view.tsx` (~Z. 334-341), auch verlinkt aus der
      Glocke im Header (`dashboard-header.tsx` ~Z. 239-252) – reiner
      Platzhaltertext, keine Anbindung. Braucht ein eigenes
      Datenmodell für Opt-in/-out pro Ereignistyp (z.B. "bei neuer
      Löschanfrage per Mail benachrichtigen"), zusätzlich zu den
      bereits bestehenden reinen In-App-Glocke/Banner-Schaltern in
      `notification-settings-card.tsx` (die sind bewusst NICHT
      E-Mail, nicht verwechseln).

**Nachtrag, selbiger Tag**: Die Löschanfragen-Neugestaltung wurde
entgegen der ursprünglichen Empfehlung oben (erst Mail-Versand, dann
Neugestaltung) doch direkt umgesetzt (Nutzervorgabe) – dadurch 3
weitere Dev-Stub-Konsumenten statt der vorhergesagten Verzögerung.
Siehe [data-subject-requests.md](../knowledge-base/auth/data-subject-requests.md)
für Details. Zwei Folgevorhaben dabei zunächst vom Nutzer als
**"später"** benannt, eines davon noch selbigen Tag doch umgesetzt:
- [x] Selbstauskunft/-löschung aus dem eigenen Konto heraus – komplett
      umgesetzt (Backend zuerst, dann Klarstellung: "ich unterscheide
      backend und frontend. frontend ist die webseite für den
      endanwender und nicht die oberfläche des backends" → Dashboard-UI
      war gemeint, kein separates öffentliches Frontend): `POST
      /deletion-requests/self-service` (ohne `@RequirePermission`,
      jeder eingeloggte Nutzer; Name/E-Mail aus dem eigenen Konto,
      `linkedUserId` sofort gesetzt) + Karte "Meine Daten" in Mein
      Konto → Sicherheit (`self-service-request-card.tsx`).
- [ ] Ein allgemeines Formular im (öffentlichen) Footer als Anfragequelle
      – weiterhin offen; setzt entweder ein eigenes Formular-Modul
      (siehe 2b.10) oder eine externe, das API konsumierende Website
      voraus, da `apps/web` selbst keine öffentliche Website-
      Auslieferung hat.

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
- [x] Wartungsmodus – `AppSettings.maintenanceModeEnabled` + Dashboard-
      Hinweis; da `apps/web` reines Headless-CMS-Dashboard ohne
      öffentliche Website-Auslieferung ist, nur ein Admin-Hinweis, keine
      echte Besuchersperre (siehe
      [toast-and-system-messages.md](../knowledge-base/frontend/toast-and-system-messages.md))
      (2026-08-15)
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
- [x] Aufbewahrungsrichtlinien (Datenschutz-Seite, 2026-08-18: Fristen als
      Richtwerte + manuelle Review-Listen statt automatischer Löschung,
      siehe knowledge-base/auth/privacy-page.md)
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

### 4.4 – Master/Slave-Lizenzsystem (Websites-Verwaltung)

Mehrsitzungs-Vorhaben (Planungsstand 2026-08-24, Umsetzung noch nicht
begonnen). Ziel: eine **Master-Instanz** (diese Codebase, `C:\git\pivot`)
verwaltet mehrere ausgelieferte **Slave-Installationen** (erste:
**strasev**, `C:\git\strasev`) zentral und kann eine Installation bei
Bedarf in den Wartungsmodus versetzen (z.B. bei Zahlungsausfall). Voller
Plan inkl. Token-Design, Sicherheitsüberlegungen und offenen Punkten:
[master-slave-licensing.md](../knowledge-base/platform/master-slave-licensing.md).

**Bereits entschieden (2026-08-24):**
- [x] Ein Repo mit `DEPLOYMENT_MODE=master|slave`-Umgebungsschalter statt
      zwei getrennter Codebases
- [x] Pull-Modell (Slave fragt wöchentlich beim Master ab, nicht
      umgekehrt) – vermeidet Erreichbarkeitsanforderungen an Kunden-Domains
- [x] Signiertes Token (Ed25519, asymmetrisch – kein gemeinsames Secret),
      domain-gebunden, mit monotonem `seq`-Zähler gegen Replay/Rollback
- [x] 14 Tage Token-Laufzeit + Karenzzeit mit Warnhinweis vor echter Sperre,
      damit ein vorübergehend nicht erreichbarer Master niemals sofort den
      Wartungsmodus auslöst
- [x] Status "Entwicklung" von der Lizenzprüfung ausgenommen, zeigt
      stattdessen einen präsenten Hinweis ("Entwicklungsinstanz –
      ungeprüft")
- [x] Wartungsseite pro Installation konfigurierbar
- [x] `C:\git\strasev` als reiner Git-Checkout desselben Repos angelegt
      (noch ohne eigene `.env`/Datenbank/Port – folgt erst nach der
      Code-Basis)

**Master-seitig umgesetzt (2026-08-24):**
- [x] `Website`-Datenmodell (`packages/database/prisma/schema.prisma`)
- [x] Token-Ausstellung: `POST /license/check` (Pull-Endpunkt, Site-API-Key-
      Auth, Ed25519-Signierung über `apps/api/src/websites/
      license-token.util.ts`, generischer 401 für unbekannte Domain/falschen
      Key, monotoner `seq`-Zähler) – live gegen echte Requests verifiziert
      (korrekter/falscher Key, unbekannte Domain, Signaturprüfung,
      Manipulationserkennung, `seq`-Inkrement, Statuswechsel, Validierung,
      Berechtigungsgate)
- [x] Master-Admin-CRUD (`WebsitesController`, Pivot-exklusiv über
      `settings:read`/`settings:update`, kein neues Recht)
- [x] Eigene Seite `/dashboard/websites` (nicht mehr in den Einstellungen
      verschachtelt, siehe "Update 2026-08-24: Umbau auf eigene Seite" –
      Kacheln direkt auf dem Seitenhintergrund, kein umschließender
      Card-Kasten, echte URL-Pagination, Statusänderung nur noch über den
      "Bearbeiten"-Dialog)
- [x] Neue Sidebar-Gruppe "Administration" (nur Master, gesteuert über
      `deploymentMode` aus `GET /auth/me`) mit Menüpunkt "Webseite" und
      Unterpunkt "Module" (Platzhalter, künftige branchenspezifische
      Erweiterungen)
- [x] `DEPLOYMENT_MODE`-Env-Schalter im Master gesetzt (`master`) +
      Zod-Validierung (`env.validation.ts`)
- [ ] Echter Browser-/visueller Abgleich der neuen Websites-Kacheln (bisher
      nur Typecheck/Lint/SSR-Statuscode geprüft – kein Playwright/Chromium
      verfügbar, kein Login-Session-Cookie für einen echten Nutzer zur Hand)

**Slave-seitige Phase umgesetzt (2026-08-24):**
- [x] Modus liegt in `AppSettings.deploymentMode`, umschaltbar unter
      Einstellungen → Integrationen ("Bereitstellungsmodus") – Nutzer-
      entscheidung: UI-Schalter statt reiner Umgebungsvariable. "Slave"
      heißt in der UI "Client".
- [x] `LicenseClientService` (wöchentlicher Pull-Abruf + Sofort-Check bei
      Erstinstallation, Ed25519-Signaturprüfung, `seq`-Replay-Schutz,
      14-Tage-Gültigkeit + 7-Tage-Karenz, Uhrzeit-Manipulationsschutz über
      `lastObservedAt`)
- [x] `LicenseEnforcementGuard` (global, blockt bei "locked" alles außer
      `/health` + `/license/state`) + öffentlicher Status-Endpunkt
- [x] `MasterOnlyGuard` auf Websites-/Lizenz-Endpunkten – zusätzliche,
      verteidigungstiefe Absicherung, dass ein lokal umgeschalteter
      "Master" nie echten Zugriff bekommt (die eigentliche Grenze bleibt
      der private Signierschlüssel, siehe Knowledge-Base)
- [x] Konfigurierbare Wartungsseite (`/locked`, Next.js-Middleware-Rewrite,
      Titel/Text unter Einstellungen editierbar, Meta-Tag-Marker für die
      Master-Überwachung) + Entwicklungs-/Karenzzeit-Hinweisbanner im
      Dashboard
- [x] `WebsiteMonitorService` (Master-seitig, Nutzervorgabe: "Test, der
      regelmäßig prüft, ob eine gesperrte Seite trotzdem noch live ist" –
      offene, dokumentierte Anomalie-Erkennung statt des abgelehnten
      verdeckten Signals) + Benachrichtigung im bestehenden Postfach
- [x] Live verifiziert: Guard-Sperre/-Freigabe je Modus, `/auth/me` und
      `/license/state` korrekt aus der DB, Wartungsseite inkl. Meta-Tag
      und konfigurierbarem/Standard-Text
- [ ] `LicenseClientService.performCheck()` nicht gegen eine zweite, echte
      Slave-Installation end-to-end getestet (kein zweiter laufender
      Server verfügbar) – erfolgt natürlich bei der strasev-Einrichtung
- [ ] `WebsiteMonitorService`s echter HTTPS-Abruf nicht gegen eine reale
      Domain getestet (bewusst keine unbeteiligte externe Seite angefragt)

**Noch offen:**
- [ ] strasev-Installation technisch lauffähig machen (`.env`, Datenbank,
      Port, `pnpm install`) – Nutzervorgabe: "immer erst fragen"

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
7. ~~Seiten-Designer – freiflächiges Drag&Drop-Canvas (2b.8)~~ ✅ 2026-08-07, Basis-Modul-Bibliothek/globale Module/Live-Vorschau-Integration ✅ 2026-08-09
8. Bildoptimierung – WebP/AVIF (2b.7)
9. API-Keys für externe Anwendungen (Phase 3)
10. Dashboard mit Statistiken (4.3)
