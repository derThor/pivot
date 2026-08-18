# Datenschutz-Seite unter Verwaltung

**Datum:** 2026-08-18
**Betroffene Bereiche:** apps/api (`src/legal-documents`, `src/deletion-requests`,
`src/processing-activities`, `src/data-processors`, `src/privacy-incidents`,
`src/privacy`, `src/content`, `src/media`, `src/categories`, `src/tags`,
`src/settings`, `src/users`, `src/audit-log`), apps/web
(`src/app/dashboard/privacy`, `src/components/privacy-view.tsx` +
Dialog-Komponenten, `src/components/app-sidebar.tsx`,
`src/components/admin-menu.tsx`), `packages/database/prisma/schema.prisma`.

## Was wurde gebaut

Neue Seite `/dashboard/privacy`, erreichbar über Verwaltung → Datenschutz
(`app-sidebar.tsx`, Icon `Lock`, Permission `privacy:read`). 1:1 nach
Bildvorlage angefragt, über mehrere Rückfragen eingegrenzt (siehe "Warum
diese Lösung" unten).

- **Kopf-Statistiken** (4 Kacheln: Offene Anfragen, Rechtstexte offen,
  Aufbewahrung, Auftragsverarbeiter) + Warnbanner bei veralteten
  Rechtstexten (`SystemMessage variant="warning"`) – alle an echte Zahlen
  gebunden, keine Platzhalter.
- **Rechtstexte-Tab**: 5 Dokumente (Impressum, Datenschutzerklärung,
  Cookie-Hinweis, AGB, Barrierefreiheitserklärung), Text wird aus den 12
  bestehenden Firmenfeldern (`AppSettings.company*`) generiert
  (`LegalDocumentsService`, reine Text-Templates, keine echte
  Rechtsberatung). "Neu erzeugen" ersetzt den generierten Teil komplett,
  `manualAddendum` (eigenes Feld, aktuell nur per API editierbar, keine
  Frontend-UI dafür) wird als letzter Absatz angehängt und bleibt über
  Regenerierungen hinweg erhalten. Status "aktuell"/"Firmendaten
  geändert"/"fehlt" wird **nicht** über ein eigenes Feld getrackt, sondern
  dynamisch geprüft: neuester `company.field_updated`-Audit-Eintrag
  (bereits vorhanden, siehe `user-activity-log.md`) neuer als
  `lastGeneratedAt`?
  - **Content-Verknüpfung** (Nutzer-Nachtrag mitten in der Session): bei
    "Neu erzeugen"/"Erzeugen" wird zusätzlich eine echte `Content`-Seite
    angelegt/aktualisiert (ContentType "Seite" wiederverwendet, ein
    einzelner Rich-Text-Modulblock mit dem generierten HTML). Die Zeile in
    der Rechtstexte-Liste bekommt dadurch einen Link-Button
    (`ExternalLink`) zur Content-Bearbeitungsseite
    (`/dashboard/content/:id/edit`), sobald einmal generiert wurde.
    `LegalDocument.contentId` speichert die lose Referenz (kein FK, wie an
    anderen Stellen in der App). **Kein Public-Routing dahinter** – es
    gibt in diesem Repo keine öffentlich ausgelieferte Website, die Seite
    ist nur im Dashboard sicht-/bearbeitbar.
- **Aufbewahrung-Karte** (Teil des Rechtstexte-Tabs, wie in der
  Bildvorlage): vier Fristen als reine Richtwerte
  (`AppSettings.retention*`), **keine automatische Hintergrund-Löschung**
  (explizite Nutzervorgabe). Stattdessen für drei der vier Fristen eine
  generische `RetentionDueList`-Komponente (Liste "fällig zur Löschung" +
  Einzel-/Alles-löschen-Button, immer über `ConfirmDeleteDialog`):
  - Zugriffsprotokoll → `AuditLog`-Einträge älter als N Monate
    (`AuditLogService.findOlderThan`/`.deleteMany`).
  - Deaktivierte Konten → `User.deactivatedAt` (neues Feld, gesetzt/
    geräumt beim De-/Reaktivieren) älter als N Monate. Löschen ruft den
    **bestehenden** `POST /users/:id/anonymize`-Endpoint auf (kein neuer
    Lösch-Mechanismus neben der schon etablierten Anonymisierung).
  - Papierkorb → siehe unten.
  - Formular-Einsendungen bekommt **keine** Review-Liste – es gibt kein
    Formular-Modul in dieser App, der Wert wird nur gespeichert
    (mit Hinweistext).
- **Papierkorb** (Nutzer-Nachtrag: "überall da wo man löschen kann", nicht
  nur Content): Soft-Delete (`deletedAt`-Feld) für **Content, Media,
  Kategorien, Tags** – die vier Stellen mit einer echten Löschen-Aktion.
  Company-Locations/Webhooks/FAQ-Gruppen/Rollen bewusst ausgenommen
  (Begründung siehe unten). Jedes der vier Services bekam `restore()` +
  `permanentDelete()` + `findTrashedOlderThan()`; `remove()` setzt jetzt
  nur noch `deletedAt`. **Media ist ein Sonderfall**: `remove()` löschte
  bisher auch die physische Datei von Disk – das musste raus, Datei bleibt
  jetzt bis `permanentDelete()` liegen. Jede bestehende Leseabfrage in den
  vier Services (inkl. der **rohen SQL-Queries** in
  `ContentService.search()`/`searchCount()`) musste um
  `deletedAt: null` ergänzt werden.
  - **Kein eigenes Papierkorb-Browsing in den vier Listen-Seiten gebaut**
    (Content/Medien/Kategorien/Tags) – nur die aggregierte Review-Liste
    hier in der Datenschutz-Seite. Ein "Papierkorb"-Filter/-Tab direkt in
    den vier Listen wäre ein sinnvolles Nice-to-have, aber nicht Teil
    dieser Runde.
- **5 einfache CRUD-Tabs** (Löschanfragen, Verarbeitungen,
  Auftragsverarbeiter, Vorfälle – **Datenschutzbeauftragter ist kein
  CRUD**, siehe unten): eigene, schlanke Prisma-Modelle
  (`DeletionRequest`, `ProcessingActivity`, `DataProcessor`,
  `PrivacyIncident`), je ein NestJS-Modul nach dem `categories`-Muster,
  je ein Dialog (`*-dialog.tsx`) nach dem `company-location-dialog.tsx`-
  Muster. **Kein Bildmaterial für diese 5 Tabs vorhanden** – Felder/Layout
  sind meine eigene, sinnvolle Wahl, nicht 1:1 nach Vorlage.
- **Datenschutzbeauftragter-Tab** (2026-08-18 auf Bildvorlage hin
  ausgebaut, ursprünglich nur 4 Felder): kein eigenes Modell, sondern 12
  Felder direkt auf `AppSettings` (`dpoIsExternal`, `dpoName`,
  `dpoCompany`, `dpoEmail`, `dpoPhone`, `dpoAppointedAt`, `dpoReportedAt`,
  `dpoSupervisoryAuthority` [bewusst eigenes Feld, nicht
  `companySupervisoryAuthority` – dort geht es um berufsständische
  Kammern, hier um die für Datenschutz zuständige Behörde],
  `dpoLastContactAt`, `dpoListInLegalTexts`, `dpoNotifyOnIncident`,
  `dpoMonthlyReportEnabled`) – gleiches Muster wie die Firmenfelder.
  Kopf-Karte zeigt eine Avatar-Zusammenfassung (Initialen, Name, Badge
  "extern"/"intern", Kontaktdaten), analog zur Kopfkarte der Firma-Seite.
  Alle drei Schalter sind **echte Funktionen**, kein reiner UI-Zustand:
  - "Im Impressum und in der Datenschutzerklärung nennen" → hängt bei
    aktivem Schalter (und vorhandenem Name/E-Mail) einen DSB-Absatz an
    die generierten Impressum-/Datenschutzerklärung-Texte an
    (`LegalDocumentsService`, `dpoLine()`-Helper).
  - "Bei jedem Vorfall automatisch benachrichtigen" → `PrivacyIncidentsService
    .create()` löst bei aktivem Schalter + gesetzter `dpoEmail` eine Mail
    aus.
  - "Monatsbericht per E-Mail" → neuer `PrivacyReportSchedulerService`
    (`@Cron(EVERY_1ST_DAY_OF_MONTH_AT_MIDNIGHT)`, gleiches Muster wie
    `ContentSchedulerService`), verschickt denselben CSV-Bericht wie der
    manuelle "Bericht erzeugen"-Button.
  - Beide Mail-Auslöser laufen über zwei neue `MailerService`-Methoden
    (`sendDpoIncidentNotification`, `sendDpoMonthlyReport`) – **Dev-Stubs**
    wie jede andere Mail in dieser App (kein SMTP angebunden), loggen nur.
  - "Meldeformular öffnen" (rechte Spalte) ist **bewusst deaktiviert** –
    es gibt keine reale, konfigurierbare Ziel-URL für dieses stark
    landesbehörden-spezifische Formular, ein `disabled`-Button ist
    ehrlicher als ein erfundener Link.
  - "Anfragen 2026" (Kontaktweg-Karte) ist eine echte Zahl:
    `DeletionRequest`-Einträge, deren `createdAt` im laufenden
    Kalenderjahr liegt.
  - Neue geteilte Komponente `switch-row.tsx` (aus `settings-form.tsx`
    extrahiert, `description` jetzt optional), da der DSB-Tab dieselbe
    Zeilen-Optik für seine drei Schalter braucht.
- **CSV-Bericht** ("Bericht erzeugen"): `GET /privacy/report`
  (`PrivacyService.generateReportCsv()`) baut den CSV-Text aus denselben
  Aggregaten wie die Kopf-Statistiken. Download läuft über einen Blob im
  Browser (gleiches Muster wie `export-profile-button.tsx`), nicht über
  eine direkte Datei-Navigation.
- **Neue Berechtigungs-Ressource** `privacy` (`read`/`create`/`update`/
  `delete`) in `permissions.catalog.ts` **und** `seed.ts` registriert
  (beide müssen synchron gehalten werden, kein Single Source of Truth,
  siehe `rbac-rework.md`). Nur Administrator bekommt sie automatisch
  (volle `PERMISSIONS`-Liste).

## Warum diese Lösung

Nutzer-Anfrage war ursprünglich 1:1 nach einer sehr umfangreichen
Bildvorlage (Kopf-Statistiken, 6 Tabs, Aufbewahrung-Karte). Über mehrere
gezielte Rückfragen (AskUserQuestion) wurde der reale Umfang
festgelegt statt zu raten:

1. "Bericht erzeugen" → echter CSV-Export (Nutzerwunsch, keine PDF-Lib im
   Repo vorhanden).
2. Aufbewahrung → Werte speichern + Review-Liste mit manueller Löschung,
   explizit **keine** automatische Hintergrund-Löschung ("So das es immer
   geprüft wird").
3. Die 5 unbekannten Tabs → jetzt als einfache echte Listen bauen (nicht
   auf ein zukünftiges Bildmaterial warten).
4. Papierkorb-Scope → "überall da wo man löschen kann", nicht nur Content
   – daraus wurde die Vier-Entitäten-Erweiterung (Content/Media/
   Kategorien/Tags) statt nur Content.

Mitten in der Umsetzung kamen zwei Nutzer-Nachträge, die den Umfang
nochmal erweiterten: die Content-Verknüpfung der Rechtstexte (auf die
Frage "wo legst du die Dokumente an" hin) und der Link-Button dorthin.

## Stolpersteine / Besonderheiten

- **Rechtstexte-Status folgte der verknüpften Seite nicht** (Nutzer-Bug-
  Report: "wenn Seiten gelöscht werden, muss das bei den Rechtstexten
  wieder auf fehlt gesetzt werden"): `LegalDocumentsService.findAll()`
  berechnete den Status ursprünglich nur aus `lastGeneratedAt`, ohne zu
  prüfen, ob die verknüpfte `Content`-Seite überhaupt noch existiert oder
  im Papierkorb liegt. Fix: `findAll()` lädt den Verknüpfungsstatus mit,
  setzt bei fehlender/gelöschter Seite `status: "missing"` **und** räumt
  die tote Referenz (`contentId`/`lastGeneratedAt` → `null`) in der DB
  gleich mit auf – reines Lesen heilt den Datensatz selbst.
- **Unique-Constraint-Crash beim erneuten "Erzeugen"**: Wenn die
  verknüpfte Seite in den Papierkorb verschoben (nicht endgültig
  gelöscht) wurde, belegt sie den Slug weiterhin
  (`@@unique([slug, locale])` kennt keinen "nur aktive Zeilen"-Ausschluss)
  – ein neuer `content.create()`-Versuch schlug mit `P2002` fehl (500,
  vom Frontend zunächst auch noch stillschweigend verschluckt).
  Doppel-Fix: `syncContentEntry()` sucht vor dem Anlegen explizit nach
  einer Content-Zeile mit demselben Slug (unabhängig von `deletedAt`) und
  **belebt eine gefundene Papierkorb-Zeile wieder**, statt eine
  Duplikat-Zeile zu versuchen; bei einer echten, nicht-gelöschten
  Slug-Kollision wirft der Service jetzt eine `ConflictException` mit
  klarer Meldung. Zusätzlich zeigt `privacy-view.tsx` Backend-Fehler beim
  Regenerieren jetzt sichtbar an (`legalDocumentError`-State), statt sie
  bei `!res.ok` einfach zu ignorieren.
- **Content-Soft-Delete + rohes SQL**: `ContentService.search()`/
  `searchCount()` nutzen `$queryRaw` – Prisma's `where`-Filter greift dort
  nicht, der `deletedAt IS NULL`-Filter musste manuell in beide SQL-Strings
  eingebaut werden. Leicht zu übersehen, da alle anderen Content-Methoden
  ganz normal über den Prisma-Client laufen.
- **Media-Papierkorb löscht (fast) keine Dateien mehr**: `remove()` löschte
  bisher immer auch die physische Datei – das ist jetzt erst
  `permanentDelete()` vorbehalten. Wer künftig an `MediaService` arbeitet,
  sollte das im Kopf haben (Datei bleibt nach "Löschen" absichtlich
  liegen, bis der Papierkorb geleert wird).
- **Zirkuläre Modul-Abhängigkeit bei `maxUploadSizeMb`** (separates,
  kleineres Feature aus derselben Session): `MediaService` musste
  `SettingsService` injizieren, was einen bestehenden Zyklus
  (Settings→Auth→Users→Media, jeweils per `forwardRef` aufgelöst) um eine
  weitere Kante erweiterte – `MediaModule` importiert `SettingsModule`
  jetzt ebenfalls per `forwardRef()`, sonst NestJS-Startfehler.
- **Prisma-Client-DLL-Lock unter Windows**: `prisma generate`/`db push`
  schlägt mit `EPERM` fehl, wenn irgendein laufender `nest start --watch`-
  Prozess die Client-DLL offen hält. In dieser Session liefen zeitweise
  **zwei** `nest start --watch`-Bäume parallel (Altlast aus einem früheren
  Hintergrund-Start) – beide mussten identifiziert (`Get-CimInstance
  Win32_Process` mit Kommandozeile) und beendet werden, bevor `generate`
  durchlief.
- **e2e-Tests waren komplett kaputt** (nicht durch diese Session
  verursacht, aber hier repariert): `otplib` zieht über
  `@otplib/plugin-base32-scure` das ESM-only-Paket `@scure/base`
  nach sich, das Jest mit dem Standard-`transformIgnorePatterns`
  nicht parsen konnte ("Unexpected token 'export'") – betraf **alle**
  e2e-Tests, nicht nur neue. Fix: eigene `tsconfig.jest.json`
  (`module: commonjs`, `resolvePackageJsonExports: false`, `allowJs`,
  `isolatedModules`) + `transformIgnorePatterns: []` in
  `test/jest-e2e.json` und dem `jest`-Block in `package.json`. Zusätzlich
  waren alle e2e-Tests noch auf die **alten** Rollennamen von vor dem
  RBAC-Rework (`Admin`/`Editor`) verdrahtet, obwohl `seed.ts` sie längst
  zu `Administrator`/`Chefredaktion` umbenennt (`ROLE_RENAMES`-Map in
  `seed.ts`) – 11 bzw. 4 Testdateien per Suchen/Ersetzen korrigiert.
- **`companySupervisoryAuthority` fehlte in `SettingsService.getPublic()`**
  – ein Bug aus der vorherigen Firma-Seiten-Session, beim Hinzufügen der
  DPO-Felder daneben aufgefallen und mitkorrigiert.

## Relevante Dateien

- `packages/database/prisma/schema.prisma` (`LegalDocument`,
  `DeletionRequest`, `ProcessingActivity`, `DataProcessor`,
  `PrivacyIncident`, `AppSettings`-Erweiterungen, `User.deactivatedAt`,
  `deletedAt` auf `Content`/`Media`/`Category`/`Tag`)
- `apps/api/src/{legal-documents,deletion-requests,processing-activities,
  data-processors,privacy-incidents,privacy}/*` (neu)
- `apps/api/src/{content,media,categories,tags}/*.service.ts`
  (Soft-Delete-Umbau), `*.controller.ts` (Trash/Restore/Permanent-Routen)
- `apps/api/src/users/users.service.ts` (`deactivatedAt`,
  `findDeactivatedOlderThan`)
- `apps/api/src/audit-log/audit-log.service.ts` (`findOlderThan`,
  `deleteMany`)
- `apps/api/src/mailer/mailer.service.ts` (`sendDpoIncidentNotification`,
  `sendDpoMonthlyReport`, beide Dev-Stub)
- `apps/api/src/privacy/privacy-report-scheduler.service.ts` (neu, Cron)
- `apps/api/src/settings/{dto/update-settings.dto.ts,settings.service.ts}`
  (DPO-/Retention-Felder, `maxUploadSizeMb`)
- `apps/api/src/roles/permissions.catalog.ts` +
  `packages/database/prisma/seed.ts` (`privacy`-Ressource)
- `apps/api/tsconfig.jest.json` (neu), `apps/api/test/jest-e2e.json`,
  `apps/api/package.json` (`jest`-Block) – e2e-Test-Fix
- `apps/web/src/app/dashboard/privacy/page.tsx`,
  `src/components/privacy-view.tsx` (neu, groß)
- `apps/web/src/components/{deletion-request,processing-activity,
  data-processor,privacy-incident}-dialog.tsx` (neu)
- `apps/web/src/components/segmented-picker.tsx` (neu, aus
  `settings-form.tsx` extrahiert)
- `apps/web/src/lib/bff-proxy.ts` (neu, gemeinsamer Kern für die ~20 BFF-
  Routen dieser Seite)
- `apps/web/src/components/{app-sidebar,admin-menu}.tsx` (Datenschutz-
  Eintrag, Verwaltung-Dropdown verbreitert + `max-w-[calc(100vw-2rem)]`
  gegen Überlaufen, "Websites"-Platzhaltereintrag entfernt)
- `apps/web/src/components/settings-form.tsx` (alter "Datenschutz"-Tab
  entfernt, da durch diese Seite ersetzt)

## Offene Punkte

- Manuelle Ergänzung (`manualAddendum`) hat einen Backend-Endpoint, aber
  keine Frontend-UI zum Bearbeiten – aktuell nur über die API setzbar.
- Kein Papierkorb-Browsing (Filter/Tab) direkt in den Listen-Seiten für
  Content/Medien/Kategorien/Tags – nur die aggregierte Review-Liste hier.
- Die 5 einfachen CRUD-Tabs sind funktional, aber ohne Bildvorlage
  entstanden – falls später eine Bildvorlage dafür kommt, eher als
  Neubau denken statt als Fein-Anpassung.
