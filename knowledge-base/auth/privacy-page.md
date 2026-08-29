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

## Nachtrag 2026-08-20 (4): "Bericht erzeugen" deckt jetzt alle sechs Tabs ab

Nutzervorgabe: "bericht bei datenschutz mmuss alles enthalten. alle tabs
in datenschutz" – `PrivacyService.generateReportCsv()` war bisher nur
eine Kennzahlen-Tabelle (Anzahl offen/veraltet/etc. je Tab). Jetzt echte
Datensatz-Zeilen für jedes Element aus Rechtstexten, Anfragen,
Verarbeitungen, Auftragsverarbeitern, Vorfällen und dem
Datenschutzbeauftragten (Bereich/Feld/Wert-Format, eine Zeile pro Feld
pro Datensatz – gleiches Muster wie der SAR-Export), Aufbewahrung bleibt
als Kennzahl (Listen wären hier nur IDs ohne Mehrwert). Neu ergänzt bei
dieser Gelegenheit: `ProcessingActivity.retentionPeriod` (Löschfrist,
Freitext wegen gemischter Formate "90 Tage"/"bis Widerruf"/"10 Jahre") –
fehlte bisher komplett im Modell, jetzt auch im Verarbeitungen-Tab
(als Tabelle statt Kartenliste, 1:1 nach Bildvorlage) und im Bericht.

## Nachtrag 2026-08-20 (3): Vorfälle-Tab als Liste+Detail, Pflichtangaben-Check, Standorte-Feld-Swap

Drei Nachträge derselben Session, gebündelt dokumentiert (Nutzervorgabe
zwischendurch: "und nutze immer knowledge base" – wurde bisher zwar
befolgt, aber zu kleinteilig; ab jetzt gesammelt statt pro Einzelschritt).

- **Vorfälle-Tab** (Nutzervorgabe: "baue jetzt vorfälle korrekt nach
  screen"): einfache Kartenliste durch Liste+Detail ersetzt, gleiches
  Muster wie [Betroffenenanfragen](./data-subject-requests.md), neue
  Komponente `privacy-incidents-panel.tsx`. `PrivacyIncident` bekommt vier
  neue Felder: `affectedCount` (Betroffene, manuelle Zahl),
  `authorityNotifiedAt`/`subjectsNotifiedAt` (Art. 33/34 DSGVO-Meldungen,
  gesetzt über neue Attestierungs-Endpunkte `POST .../report` und
  `POST .../notify-subjects` – **keine** echte Behörden-/Massen-Mail,
  gleiches "Attestierung statt Live-Aktion"-Prinzip wie bei den
  Betroffenenanfragen, da es keine feste Empfängerliste gibt) und
  `measuresDocumented` (Freitext, Teil des normalen Bearbeiten-Dialogs).
  Das bestehende `status`-Feld (open/resolved) bleibt unverändert als
  grobe Dashboard-Ampel (`PrivacyService`) – die neue "Ablauf"-Karte mit
  5 Schritten (Erfassen/Bewerten/Melden/Informieren/Dokumentieren) wird
  stattdessen rein aus `severity` +
  den drei neuen Zeitstempel-/Textfeldern berechnet, kein weiteres
  gespeichertes Status-Feld (gleiches Prinzip wie "Veraltet" bei
  `LegalDocument`). **`severity="low"` macht alle drei Melde-Schritte
  gegenstandslos** (Badge "kein Risiko", keine Buttons) – Art. 33/34
  verlangen dann keine Meldung. "Meldung ansehen" ist ein neuer,
  auto-generierter Protokoll-CSV-Report (`generateReportCsv`, gleiches
  Feld/Wert-Muster wie der DSR-Datenauszug), kein manuell verfasster
  Meldetext.
- **Pflichtangaben-Check** (Rechtstexte-Tab, rechte Spalte, als erste
  Karte vor "Aufbewahrung", Nutzervorgabe per Screenshot): gruppiert die
  Firmen-Stammdaten (`company-fields.ts`) nach §5 TMG-Positionen
  ("Anschrift"/"Register & Nummer" fassen je mehrere Einzelfelder
  zusammen). Neues Feld `companyDisputeResolution` (Streitschlichtung,
  §36 VSBG) ergänzt – überall dort, wo companySupervisoryAuthority schon
  auftauchte (Schema, DTO, Stammdaten-Formular, Impressum-Generator,
  Aktivitätsprotokoll-Label). **Bewusst NICHT ergänzt**:
  "Berufsrechtliche Regelung" – ursprünglich mitgebaut, dann per
  Nutzervorgabe ("komplett weg") wieder vollständig entfernt, da nur für
  reglementierte Berufe relevant und auf diese Firma nicht zutreffend.
- **Standorte-Formular** (Firma-Seite, Nutzervorgabe: "bei standorte
  email adresse mit aufnehmen, öffnungszeiten da raus"): `openingHours`
  komplett aus Schema/DTO/Formular/Detailanzeige entfernt (nicht nur
  ausgeblendet – "setzen wir anders später um", kommt in anderer Form
  zurück), an derselben Stelle durch neues Feld `email` ersetzt.

## Nachtrag 2026-08-20 (2): Popup-Breitenbug + echte Löschung von AV-Vertrag/SCC-Vorlage

Drei kleine Nutzer-Bugreports (Screenshots) direkt im Anschluss an den
Auftragsverarbeiter-Umbau oben:

- **Globaler Dialog-Breitenbug** ("global dieses problem mit popup
  beheben"): ein langer, leerzeichenfreier Name/Dateiname (z.B.
  "Merkzettel_Vorstellungsgespraech_KDO_Wessels.docx") sprengte trotz
  des bereits vorhandenen `truncateMiddle()`-Helpers (`lib/utils.ts`,
  kappt auf 40 Zeichen) bei ungünstiger Zeichenbreite/Viewport die
  feste Dialogbreite (`max-w-xs`/`sm:max-w-sm`). Ursache: Grid-/Flex-
  Kinder haben ohne `min-w-0` einen `min-width: auto` (inhaltsbasiert),
  und ohne `break-words`/`truncate` kann ein Wort ohne Leerzeichen
  nicht umbrechen. Fix in `ui/alert-dialog.tsx` (`AlertDialogHeader` +
  `AlertDialogTitle`) und `ui/dialog.tsx` (`DialogTitle`, `DialogHeader`
  hatte `min-w-0` schon von einem früheren Fix,
  [[feedback_dialog_scroll_flex_squish]]): beide Titel bekommen jetzt
  `min-w-0 break-words`. Nutzer akzeptierte Umbruch statt Kürzung als
  Lösung ("dann zur Not mit … arbeiten"), Umbruch behält den vollen
  Namen sichtbar (wichtig bei einer Lösch-Bestätigung) statt ihn
  wegzukürzen – bewusst *nicht* `truncate` gewählt, obwohl das die
  ursprünglich vorgeschlagene Rückfalllösung war.
- **Vertrags-PDF (AV) wirklich löschbar**: der "entfernen"-Chip in
  `data-processor-dialog.tsx` hat vorher nur lokalen Formular-State
  geleert, ohne die zugrundeliegende `Media`-Datei zu löschen (Datei
  blieb verwaist liegen). `handleRemoveContract()` ruft jetzt echtes
  `DELETE /api/media/:id` auf (Soft-Delete in den Papierkorb, gleiches
  Muster wie `logo-upload-field.tsx`s `handleRemove()`), erst danach
  wird der Formular-State geleert.
- **SCC-Vorlage wirklich löschbar**: die Drittlandtransfer-Karte in
  `privacy-view.tsx` hatte nach dem Upload nur einen Download-Button,
  keinen Weg zum Entfernen. Neues `handleRemoveSccTemplate()`: setzt
  erst `AppSettings.sccTemplateMediaId` per `PATCH /api/settings` auf
  `null`, löscht dann die `Media`-Datei per `DELETE /api/media/:id`
  (Soft-Delete) – Reihenfolge wichtig, sonst zeigt die Seite kurz auf
  eine schon gelöschte Datei.
- **Datei-Upload-Feld volle Breite**: das Vertrags-PDF-`<Input type="file">`
  hatte fälschlich `max-w-xs` (Nutzer: "hier die input volle breite") –
  jetzt schlicht `w-full`.

Alle vier Punkte mit echtem Playwright-Durchlauf verifiziert (Login,
Datei-Upload/-Löschung, Netzwerk-Requests mitgeloggt, Testdaten danach
über die App-eigenen Lösch-Endpunkte wieder entfernt).

## Nachtrag 2026-08-20: Auftragsverarbeiter-Tab 1:1 nach Bildvorlage

Kompletter Umbau des bisherigen einfachen Karten-Tabs "Auftragsverarbeiter"
(Nutzervorgabe: "setze auftragsverarbeiter genau nach screener um") in
eine Liste+Detail-Ansicht (Muster: Betroffenenanfragen-Tab).

- **Neue `DataProcessor`-Felder**: `location` (Ort, freier Text, z.B.
  "Hamburg, DE"), `complianceNote` (Zusatzhinweis in der Listenzeile,
  z.B. "ISO 27001"/"Angemessenheitsbeschluss"/"eigener Server"/"SCC
  ausstehend" – bewusst freier Text statt Ableitung aus dem Ort, keine
  EU-Länder-Logik), `outsideEu` (manuelles Drittlandtransfer-Häkchen,
  keine automatische Länder-Erkennung), `contactEmail` (für "AV-Vertrag
  anfordern").
- **Listenzeile**: Name + "seit {Vertragsdatum} · {Zusatzhinweis}",
  Zweck, Ort mit Pin-Icon, Badge "AV-Vertrag" (grün)/"AV fehlt" (amber)
  – ersetzt die bisherigen Labels "mit/ohne AV-Vertrag". "+ Auftrags-
  verarbeiter ergänzen" ist jetzt eine Zeile am Listenende statt eines
  Header-Buttons (Muster: Betroffenenanfragen-/Papierkorb-Listen).
- **"Offene Punkte"-Karte** (rechte Spalte): pro Auftragsverarbeiter
  ohne `hasContract` ein Eintrag ("X — AV-Vertrag [und
  Standardvertragsklauseln, falls `outsideEu`] fehlen") + eigener
  "AV-Vertrag anfordern"-Button. Button ruft `POST /data-processors/
  :id/request-contract` auf (`DataProcessorsService.requestContract()`,
  Dev-Stub-Mail wie überall in dieser App) – wirft `BadRequestException`
  ohne hinterlegte `contactEmail`, da ein generischer Empfänger keine
  echte Anfrage wäre.
- **"Drittlandtransfer"-Karte**: Text nennt die betroffenen Dienstleister
  namentlich (nicht generisch), "Vorlage herunterladen"/"Vorlage
  hochladen" – neues `AppSettings.sccTemplateMediaId` (+ `sccTemplateMedia`-
  Relation zu `Media`), admin-hochgeladene SCC-Datei. **Kein erfundenes
  Rechtsmuster im Repo** (Nutzer-Antwort auf Rückfrage: "Admin kann eine
  Datei hochladen") – Upload direkt in dieser Karte, kein Umweg über
  eine Einstellungsseite.
- **Datenfluss-Stolperstein**: `app/dashboard/privacy/page.tsx` nutzt
  `getSettings()` (roh, kein `Media`-Include im Backend), `sccTemplateMedia`
  kommt aber nur über `getPublic()`/`getPublicSettings()` mit – Seite
  ruft jetzt zusätzlich `getPublicSettings()` parallel auf, nur für
  dieses eine Feld, statt den globalen `get()`/`getSettings()`-Rückgabewert
  für alle Aufrufer aufzubohren.
- Drei Rückfragen vor dem Bauen geklärt (AskUserQuestion): "AV-Vertrag
  anfordern" = echte Dev-Stub-Mail (nicht Platzhalter), SCC-Vorlage =
  echter Admin-Upload (nicht erfunden/nicht Platzhalter), Drittland-
  Erkennung = manuelles Häkchen (keine Länder-Logik).

## Nachtrag 2026-08-19: Betroffenenrechte-Karte + CSV-Bericht auf Deutsch

Neue Karte "Betroffenenrechte" im Rechtstexte-Tab, per Bildvorlage
unterhalb der Rechtstexte-Karte in der **linken** Spalte platziert
(rechte Spalte bleibt die Aufbewahrung-Karte).

- Zwei Schalter (`dsbFormSelfServiceDisclosure`,
  `dsbFormStoreSubmissionIp`, beide auf `AppSettings`) sind **bewusst
  vorgehalten, nicht funktional** – es gibt in dieser App kein
  Formular-Modul, an das sie andocken könnten. Hinweistext macht das
  im UI transparent.
- **"Auskunft erstellen"** (Art. 15 DSGVO, `SubjectAccessRequestDialog`):
  Personenauswahl (anonymisierte/gelöschte Konten werden aus der Liste
  gefiltert – für sie gibt es keine personenbezogenen Daten mehr, zu
  denen sich eine Auskunft erstellen ließe), dann `GET
  /privacy/subject-access-report/:userId` (`PrivacyService
  .generateSubjectAccessReportCsv()`) – sammelt Konto, Aktivitätsprotokoll,
  verfasste Inhalte, hochgeladene Medien über bereits bestehende Services,
  kein separates Datenmodell nur für den Bericht.
  - **"Auskunft senden"** (Nutzer-Nachtrag): zusätzlicher Button, nutzt
    dieselbe CSV-Erzeugung, verschickt sie aber per Mail an die im Konto
    hinterlegte Adresse (`POST
    /privacy/subject-access-report/:userId/send` →
    `MailerService.sendSubjectAccessReport`, Dev-Stub wie jede Mail in
    dieser App). Kein eigenes Empfänger-Feld, absichtlich.
- **"AV-Vertrag herunterladen"**: neuer geschützter System-Ordner "AVs"
  (`MediaFolder.isSystem: true`, in `seed.ts` wie "Logo"/"Avatare"
  angelegt – Ordner selbst nicht löschbar, Inhalt schon).
  `DataProcessorDialog` bekommt ein Datei-Upload-Feld ("Vertrags-PDF"),
  das direkt in diesen Ordner hochlädt (`DataProcessor.contractMediaId`
  → `Media`-Relation). Der Button lädt `GET
  /data-processors/contracts.zip` (`streamContractsZip()`, `archiver`)
  – zippt alle Dateien im "AVs"-Ordner zusammen, kein Auswahl-Dialog nötig.
  - **`archiver`-Versionsfalle**: `pnpm add archiver` zog zunächst v8
    (reines ESM, keine Factory-Funktion mehr, `archiver('zip', opts)`
    existiert nicht) – inkompatibel mit diesem CJS/ts-node-Setup. Fix:
    Downgrade auf `archiver@^7` + `@types/archiver@^6` für die
    klassische Factory-API.
- **CSV-Bericht auf Deutsch** (Nutzer-Bugreport per Screenshot: Mojibake
  "AktivitÃ¤tsprotokoll" + roher Aktionscode "user.impersonate" in der
  Auskunft-CSV):
  - `describeAuditAction()` in `privacy.service.ts` – schlanke,
    text-only Kopie von `describeActivity()`
    (`user-activity-timeline.tsx`), übersetzt Audit-Log-Aktionscodes in
    deutsche Kurztexte, unbekannte Codes fallen wie im Frontend auf den
    rohen Code zurück.
  - **UTF-8-BOM fehlte im Download, obwohl der Service-Code ihn korrekt
    voranstellt** (`CSV_BOM = '﻿'`) – der eigentliche Bug lag nicht
    im Backend, sondern in `bff-proxy.ts`: die `text/csv`-Weiche nutzte
    `backendRes.text()`, und `Response.text()` dekodiert laut
    WHATWG-Encoding-Standard als UTF-8 **und entfernt dabei automatisch
    ein führendes BOM**. Fix: wie die `application/zip`-Weiche daneben
    auf `arrayBuffer()` umgestellt, um die Bytes unverändert
    durchzureichen. Byte-genau via `curl`/`xxd` verifiziert (`ef bb bf`
    jetzt im ausgelieferten Download vorhanden). Betraf beide
    CSV-Downloads dieser Seite (`/privacy/report` und
    `/privacy/subject-access-report/:userId`), nicht nur die Auskunft.

## Nachtrag 2026-08-19: Umlaute in Original-Dateinamen (Media-Upload)

Nutzer-Nachtrag ("und umlaute bei dokumenten download beachten") deckte
einen zweiten, verwandten Bug auf: Der Original-Dateiname eines
Uploads (z.B. für den AV-Vertrag) kam bereits **beim Hochladen**
verstümmelt an ("Vertrag_Müller.pdf" → "Vertrag_MÃ¼ller.pdf"), lange
bevor der ZIP-Download überhaupt ins Spiel kam – per Playwright/Node-
Testskript verifiziert, das die rohe Upload-Antwort inspizierte.
Ursache: Busboy/Multer dekodieren den `filename`-Header aus
`multipart/form-data` laut Spec als Latin-1, obwohl Browser die Bytes
als UTF-8 senden – ein bekannter, plattformübergreifender Multer-
Stolperstein, nicht spezifisch für dieses Repo. Fix: `MediaService
.create()` re-dekodiert `file.originalname` einmal am Eintrittspunkt
(`Buffer.from(file.originalname, 'latin1').toString('utf8')`), bevor
der Name in der DB landet oder ins Audit-Log geschrieben wird – betrifft
jeden Upload-Weg (Medien-Bibliothek, Avatare, AV-Verträge), nicht nur
diese eine Stelle. `archiver` selbst setzt das UTF-8-Flag für ZIP-
Einträge bereits korrekt (per PowerShell `Expand-Archive` verifiziert),
war also nicht die Fehlerquelle.

## Nachtrag 2026-08-19: Löschanfrage-Dialog – Person wählbar, Mobil-Fix

- **`DeletionRequestDialog`**: neues optionales Select "Bestehende Person
  wählen" oberhalb von Name/E-Mail (Nutzervorgabe: "Löschanfrage muss
  ein Nutzer auch auswählbar sein"). Übernimmt bei Auswahl nur Name/
  E-Mail als Vorbelegung in die bestehenden freien Textfelder – beide
  bleiben danach editierbar, für externe Anfragen (Post/Telefon, kein
  Konto) bleibt reine Freitext-Eingabe weiterhin möglich. Gleiches
  Filter-/Sortier-Muster wie `SubjectAccessRequestDialog`
  (anonymisierte Konten raus, `formatName`-Sortierung).
- **`SubjectAccessRequestDialog`-Footer bei jeder Breite ≥640px
  abgeschnitten** (Nutzer-Bugreport per Screenshot, zwei Runden): drei
  Buttons passten nicht in die Standard-Dialogbreite `sm:max-w-md`
  (448px) – "Abbrechen" wurde rechts abgeschnitten statt umzubrechen.
  **Erster Fix-Versuch war unzureichend**: nur den Zeilen-Umbruchpunkt
  der `DialogFooter` auf `md` verschoben, ohne die eigentliche Ursache
  (zu schmaler Dialog) zu beheben – sobald die Zeilen-Ansicht ab `md`
  wieder aktiv wurde, war der Dialog immer noch zu schmal für drei
  Buttons nebeneinander (Nutzer: "popup ist immer noch zerschossen").
  **Eigentlicher Fix**: `DialogContent` von `sm:max-w-md` auf
  `sm:max-w-xl` verbreitert + `flex-wrap` auf der `DialogFooter` als
  Sicherheitsnetz (bricht um statt zu clippen, falls die Zeile durch
  Zoom/längere Übersetzungen doch mal eng wird). Bei vier Breiten
  (375/700/950/1440px) per Playwright-`boundingBox()`-Prüfung
  verifiziert, dass alle drei Buttons vollständig innerhalb des
  Viewports liegen – **Lehre**: bei zu breitem Inhalt in einem
  `max-w-md`/`max-w-lg`-Dialog zuerst die Dialogbreite selbst prüfen,
  nicht nur den Flex-Umbruchpunkt der Footer-Zeile.

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
- `apps/web/src/components/privacy-incidents-panel.tsx` (neu, 2026-08-20,
  Liste+Detail statt Kartenliste)
- `apps/api/src/company-locations/*`, `apps/web/src/components/
  company-location-dialog.tsx` (2026-08-20: `email` statt `openingHours`)
- `apps/web/src/components/segmented-picker.tsx` (neu, aus
  `settings-form.tsx` extrahiert)
- `apps/web/src/lib/bff-proxy.ts` (neu, gemeinsamer Kern für die ~20 BFF-
  Routen dieser Seite)
- `apps/web/src/components/{app-sidebar,admin-menu}.tsx` (Datenschutz-
  Eintrag, Verwaltung-Dropdown verbreitert + `max-w-[calc(100vw-2rem)]`
  gegen Überlaufen, "Websites"-Platzhaltereintrag entfernt)
- `apps/web/src/components/settings-form.tsx` (alter "Datenschutz"-Tab
  entfernt, da durch diese Seite ersetzt)
- `apps/api/src/data-processors/*` (`contractMediaId`,
  `streamContractsZip()`), `apps/api/src/privacy/privacy.service.ts`
  (`describeAuditAction()`, `CSV_BOM`, `generateSubjectAccessReportCsv`,
  `sendSubjectAccessReport`) – Nachtrag 2026-08-19
- `apps/web/src/components/{subject-access-request-dialog,
  data-processor-dialog}.tsx`, `apps/web/src/lib/bff-proxy.ts`
  (CSV-Weiche auf `arrayBuffer()` umgestellt) – Nachtrag 2026-08-19
- `packages/database/prisma/seed.ts` (System-Ordner "AVs")

## Nachtrag 2026-08-29: Anonymisierungs-Countdown im Reiter "Nutzer"

Nutzervorgabe: "je Benutzer eine Zeitanzeige, wann anonymisiert werden
muss, wie bei Papierkorb". `UsersService.findDeleted()` rechnet jetzt pro
Nutzer eine individuelle Deadline (`deletedAt` + `retentionDeactivated
AccountsMonths`) und `daysLeft` aus, statt nur ein geteiltes
`overdue`-Flag gegen einen einzigen Cutoff – analog zu
`TrashService.withExpiryMeta`s `deletedAt` + `retentionDays` (dort Tage,
hier Monate, da so konfiguriert). `PrivacyService.findDeactivatedAccountsDue()`
übergibt dafür die rohe Monatszahl statt eines vorgerechneten Datums.
Frontend zeigt dieselbe "in X T."-plus-Fortschrittsbalken-Optik wie
`trash-view.tsx` (Badge "überfällig" ersetzt durch "Frist abgelaufen" mit
Schloss-Icon, sobald `daysLeft <= 0`).

Hängt mit dem Bugfix aus
[master-slave-licensing.md](../platform/master-slave-licensing.md#bugfix-gelöschte-nutzer-blieben-für-immer-hängen-wenn-datenschutz-inaktiv-ist-2026-08-29)
zusammen (gleicher Tag): der dort behobene Fall (Datenschutz-Modul
komplett inaktiv → sofortige Anonymisierung statt Warteschlange) betrifft
genau diese Liste.

## Offene Punkte

- Manuelle Ergänzung (`manualAddendum`) hat einen Backend-Endpoint, aber
  keine Frontend-UI zum Bearbeiten – aktuell nur über die API setzbar.
- ~~Kein Papierkorb-Browsing...~~ – inzwischen durch die eigenständige
  Seite `/dashboard/trash` gelöst, siehe [trash-page.md](../content/trash-page.md).
- Die 5 einfachen CRUD-Tabs sind funktional, aber ohne Bildvorlage
  entstanden – falls später eine Bildvorlage dafür kommt, eher als
  Neubau denken statt als Fein-Anpassung.
