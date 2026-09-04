# Einstellungsseite: neue Sidebar-Navigation nach Bildvorlage

**Datum:** 2026-08-17
**Betroffene Bereiche:** apps/web (`src/components/settings-form.tsx`,
`src/app/dashboard/settings/page.tsx`)

## Was wurde gebaut

Die Einstellungsseite (`/dashboard/settings`) hatte bisher eine horizontale
`Tabs`-Leiste mit 4 Reitern (Firma, Zugriff & Funktionen, Sicherheit,
Darstellung). Nach Bildvorlage komplett umgebaut auf eine linke
Sidebar-Navigation mit 7 Bereichen, exakt im Layout-Muster von
`navigation-explorer.tsx` (Menüs-Seite): ein `rounded-xl border-[#E5E5E5]`-
Container, darin die Einträge per `divide-y divide-[#F0F0F0]` getrennt,
**volle Breite pro Zeile** (kein einzelner Rahmen/keine Rundung pro Item,
kein Innenabstand am Container – erste/letzte Zeile schließt bündig mit
den abgerundeten Ecken ab), aktive Zeile mit `border-l-4 border-l-primary
bg-lime-50` (linker grüner Akzentbalken + lime Hintergrund), Hover auf
inaktiven Zeilen als `hover:bg-muted/50`-Balken über die volle Breite.

**Erste Version hatte einzeln umrandete, abgerundete Boxen pro Sidebar-
Eintrag (mit `p-2`-Außenabstand am Container)** – auf Nutzer-Feedback
("hover voll durchgehen, links grüner balken", "erstes und letztes
element kein weisser rand nach oben und unten") auf das oben beschriebene
volle-Breite-Muster korrigiert, das dem bereits bestehenden
`navigation-explorer.tsx`-Sidebar-Muster entspricht.

Jeder Eintrag: Icon in einer `rounded-lg`-Box (aktiv: `bg-lime-100
text-lime-700`, inaktiv: `bg-[#F4F4F5] text-muted-foreground`) + Titel +
graue Unterzeile. Icons (lucide-react): `Menu` (Zugriff & Funktionen),
`Shield` (Sicherheit), `Contrast` (Darstellung), `Plug` (Integrationen),
`Lock` (Datenschutz), `Bell` (Benachrichtigungen), `History` (Protokoll).

Kopfbereich (Titel + Breadcrumb + "Verwerfen"/"Speichern") 1:1 nach
Bildvorlage in `SettingsForm` verlagert (vorher `PageHeader` in
`page.tsx` + ein einzelner "Einstellungen speichern"-Button unten). Neuer
"Verwerfen"-Button: `form.reset(defaultValues)` + Zurücksetzen der lokal
gehaltenen Firmenfelder/Speicherkontingent-States auf die ursprünglich
geladenen Werte. Bestehende Umschalter-Zeilen (`SwitchRow` und die
manuellen Zeilen für Mindestlänge/Speicherkontingent/Cache/Einträge pro
Seite) auf dieselbe umrandete Box-Optik (`rounded-lg border-[#F0F0F0]
bg-[#FAFAFA] p-4`) umgestellt wie die Modul-Zeilen der Bildvorlage.

## Bewusst nicht wie in der Bildvorlage gebaut (kein erfundener Wert)

Die Bildvorlage zeigt für "Zugriff & Funktionen" eine **Modul-Ein/Aus-
Liste** ("Module & Erweiterungen": Formulare, Galerien, FAQs,
Vorschau-Links, Webhooks, Systemnachrichten, Mehrsprachigkeit, je mit
Versions-Badge) sowie einen "Redaktionsablauf"-Bereich (Freigabe vor
Veröffentlichung, Kommentare an Entwürfen, …). **Beides existiert nicht
als echtes Feature** – es gibt keine modul-weisen Aktivierungs-Flags
(Formulare sind ohnehin kein gebautes Modul in dieser App) und keinen
Freigabe-/Approval-Workflow (siehe `docs/ROADMAP.md`, Phase 2b.9
"Workflow", weiterhin offen). Der Bereich "Zugriff & Funktionen" zeigt
stattdessen weiterhin die **echten** bestehenden Selbstbedienungs-
Schalter (Registrierung, Passwort-Reset, E-Mail-Änderung,
Admin-Freischaltung, Autosave, Bildvarianten, Wartungsmodus,
Speicherkontingent, Cache leeren).

**"NEU"-Badges bewusst weggelassen** (Nutzervorgabe: "ohne neu batch").

**Bestehende Inhalte neu einsortiert:**

- "Firma" (bisher eigener Tab) → jetzt unter **Datenschutz**
  (Firmenangaben fürs Impressum passen inhaltlich besser dorthin als zu
  einem eigenen Tab).
- Firmenlogo-Upload → jetzt unter **Darstellung** (passt zur
  Bildvorlage-Unterzeile "Logo, Akzentfarbe, Dichte").
- Passwort-Richtlinie + 2FA → unverändert unter **Sicherheit**.
- "Einträge pro Seite" → unverändert unter **Darstellung**.

**Nachtrag 2026-08-21: Webhooks von eigener Seite nach Einstellungen
verschoben** (Nutzervorgabe: "setze webhooks unter einstellungen") –
`/dashboard/webhooks` gibt es nicht mehr, der Sidebar-Eintrag unter
Verwaltung ebenfalls nicht. `WebhooksManager`/`WebhookDialog`/
`WebhookFailureBanner` + Pagination leben jetzt in einem **eigenen**
Abschnitt "Webhooks" von `settings-form.tsx` (zunächst versehentlich in
"Integrationen" verschachtelt, auf Nutzer-Feedback ["mach es als
einzelnen punkt"] wieder in einen eigenen, siebten `SectionId`-Eintrag
aufgeteilt – "Integrationen" zeigt jetzt wieder nur die
API-Schlüssel-Platzhalterkarte). Daten kommen serverseitig über einen
eigenen Query-Param `?webhooksPage=` (statt `?page=`, um nicht mit einer
künftigen Pagination in einem anderen Abschnitt zu kollidieren).

**Eigenes `webhooks`-Rechte-Bündel komplett entfernt** (Nutzervorgabe,
gleicher Tag: "webhooks brauchen keine eigenen rechte mehr, soll komplett
über einstellungen gehen") – ursprünglich beim RBAC-Neubau (2026-08-16)
bewusst als eigenes Bündel angelegt (siehe rbac-rework.md), jetzt auf
`settings:read`/`settings:update` konsolidiert:
`WebhooksController` nutzt diese beiden Permissions statt
`webhooks:{read,create,update,delete}`, die vier `webhooks:*`-Einträge
sind aus `permissions.catalog.ts`/`seed.ts` (`PERMISSIONS`) entfernt und
in `seed.ts`s `OBSOLETE_PERMISSIONS` überführt (räumt die alten
`RolePermission`-Zeilen automatisch weg, gleiches Muster wie beim
RBAC-Neubau). Die Rolle "Manager" schloss Webhooks bereits vorher explizit
aus (`description`: "…außer … und Webhooks") – das ergibt sich jetzt
automatisch daraus, dass Manager schon `settings:update` nicht hat,
der extra `p.resource !== "webhooks"`-Filter in ihrer
Permission-Zusammenstellung wurde entfernt. `apps/web/src/lib/
permission-labels.ts` (`resourceLabels`/`resourceIcons`) ebenfalls um den
toten `webhooks`-Eintrag bereinigt. **Seed wurde ausgeführt**
(`npm run seed` in `packages/database`), Änderung ist in der Dev-DB
bereits wirksam.

**Nachtrag 2026-08-21 (2): Benachrichtigungs-Kategorien von
Systemnachrichten hierher verschoben, mit Erklärungen** (Nutzervorgabe:
"verschiebe die benachrichtigungs einstellungen von systembenachrichtigung
unter einstellung benachrichtigung", direkt gefolgt von "und hier soll es
dann so aussehen [Screenshot der 'Zugriff & Funktionen'-Karte] mit
erklärungen") – `NotificationSettingsCard` (die 11
`notify*`-Kategorie-Schalter) lebt jetzt im "Benachrichtigungen"-Abschnitt
von `settings-form.tsx` statt in einer eigenen rechten Spalte auf
`/dashboard/system-messages` (der Grid dort wurde entsprechend auf eine
Spalte zurückgebaut). Visuell auf `SwitchRow` (Label + Beschreibung, siehe
"Zugriff & Funktionen") umgestellt statt bloßem Label+Switch – jede der
11 Kategorien hat jetzt eine erklärende Zeile. Instant-Save je Zeile
bewusst beibehalten (kein Teil des großen Speichern/Verwerfen-Formulars),
das war schon vorher so und ändert sich durch den Umzug nicht. Die
Systemnachrichten-Seite bekam stattdessen eine schlichte Hinweiszeile
("Welche Kategorien hier erscheinen, lässt sich unter Einstellungen →
Benachrichtigungen steuern.").

**Drei Bereiche sind weiterhin reine, ehrliche Platzhalter-Karten**
(gleiche Konvention wie die Darstellung-/Benachrichtigungen-Tabs auf
"Mein Konto" – kein erfundener Inhalt, nur eine Notiz):

- **Akzentfarbe & Dichte** (innerhalb Darstellung) – kein Farbschema/keine
  kompakte Listendarstellung vorhanden.
- **Datenschutz-Zusatz** ("Aufbewahrung, Cookies, AV") – keine
  Aufbewahrungsfristen-/Cookie-Consent-/AV-Verwaltung vorhanden.
- **Benachrichtigungen** ("Absender & Systemmails") – kein
  SMTP-Absender-Konfigurationsfeature vorhanden. Hinweis, dass die
  bestehenden `notify*`-Kategorie-Schalter weiterhin auf der Seite
  "Systemnachrichten" liegen (`NotificationSettingsCard`, nicht hierher
  verschoben, um den bestehenden Ort nicht ohne Absprache zu ändern).
- **Protokoll** ("Änderungen & Export") – die Änderungshistorie ist seit
  2026-08-22 real (siehe Update unten), "Export & Sicherung" (JSON-Export,
  Zugriffsprotokoll-CSV) bleibt Platzhalter.

## Relevante Dateien

- `apps/web/src/components/settings-form.tsx` (komplett neu strukturiert;
  2026-08-21: Webhooks-UI im Integrationen-Abschnitt ergänzt)
- `apps/web/src/app/dashboard/settings/page.tsx` (kein `PageHeader` mehr,
  Header lebt jetzt in `SettingsForm`; 2026-08-21: lädt zusätzlich
  `getWebhooks()`)
- `apps/web/src/components/app-sidebar.tsx` (2026-08-21: Webhooks-Eintrag
  unter Verwaltung entfernt)
- `apps/web/src/components/settings-protocol-card.tsx` (neu, 2026-08-22)
- `apps/api/src/settings/settings.service.ts` (`SETTINGS_ENTITY_TYPE`,
  `getSettingsChanges()`, generische Feld-Protokollierung in `update()`)
- `apps/api/src/settings/dto/query-settings-changes.dto.ts` (neu)
- `apps/api/src/audit-log/audit-log.service.ts` (`findPaginated()`, neu)

## Update 2026-08-22: Protokoll – echte Änderungshistorie

Auf "baue protokolierung" (1:1 nach Bildvorlage "Letzte Änderungen an
den Einstellungen") umgesetzt, analog zur bestehenden "Letzte
Änderungen"-Karte der Firma-Seite (`company-view.tsx`), aber mit echter
Server-Pagination statt festem `limit=5` (Nutzervorgabe: "pagination bei
dem protokoll") – über die Zeit können hier deutlich mehr Einträge als
bei den 13 Firma-Feldern zusammenkommen.

- Neue Komponente `settings-protocol-card.tsx`: Zeitleiste (Punkt +
  Verbindungslinie, gleiches Muster wie Firma) + `PaginationControls`
  über den eigenen Query-Param `?protocolPage=` (analog zu
  `?webhooksPage=` bei Webhooks, damit sich die Paginierungen der
  einzelnen Abschnitte nicht überschreiben).
- `SettingsService.update()` protokolliert jetzt jedes tatsächlich
  geänderte Feld aus `UpdateSettingsDto` als eigenen `settings.
field_updated`-AuditLog-Eintrag (`entityType: 'Settings'`) – **bewusst
  ausgenommen**: Firma-Felder (`COMPANY_FIELD_KEYS`, haben mit
  `company.field_updated` bereits ihre eigene, unveränderte Historie auf
  der Firma-Seite) und Datenschutz-Felder (`PRIVACY_FIELD_KEYS`, dafür
  gibt es aktuell noch gar kein Protokoll – nicht angefragt).
- Anders als bei Firma (`{field, wasEmpty}`) speichert die neue
  Protokollierung `{field, before, after}` – Beschreibungen wie
  "Passwort-Mindestlänge auf 12 geändert" brauchen den tatsächlichen
  neuen Wert, nicht nur ob das Feld vorher leer war. Deutsche
  Feld-Labels leben rein im Frontend (`FIELD_LABELS` in
  `settings-protocol-card.tsx`, 1:1 dieselben Texte wie die
  zugehörigen Formularfelder in `settings-form.tsx`/
  `notification-settings-card.tsx`), gleiches Prinzip wie
  `describeActivity()`/`COMPANY_FIELD_LABELS` im Aktivität-Tab.
- Neuer Endpunkt `GET /settings/changes` (paginiert,
  `AuditLogService.findPaginated()`), Recht `settings:read` – also wie
  der Rest der allgemeinen Einstellungen exklusiv Pivot vorbehalten
  (siehe [[project_pivot_role_and_scoped_permissions]] in der
  Memory-Datei).
- **Bewusst nicht gebaut** (Mockup zeigte es, aber ohne reale
  Grundlage): "API-Schlüssel ... erneuert" (kein API-Schlüssel-Feature,
  Integrationen-Tab ist weiterhin Platzhalter) und "Vollständiger
  Inhaltsexport … Formulare" (Formular-Einsendungen sind kein reales
  Feature dieser App, siehe bereits bestehende Ausschlussliste bei den
  Systembenachrichtigungen).

## Update 2026-08-22: Löschfunktion, Export & Sicherung, AV-Verträge

- Protokoll-Einträge sind einzeln und komplett löschbar (Nutzervorgabe:
  "das soll man löschen können" – ursprüngliches Mockup-Label
  "Revisionssicher, nicht löschbar" wurde entfernt, da falsch).
  `AuditLogService.deleteOne()`/`deleteAllForEntity()`, Endpunkte
  `DELETE /settings/changes/:id` und `DELETE /settings/changes`, Recht
  `settings:update`. Einzellöschung als Icon-Button (`ConfirmDeleteDialog`,
  `size="icon-sm"` **mit explizitem `rounded-lg`** – der Button-Default
  für `icon-sm` ist `rounded-full`, ohne den Override wird der Button
  fälschlich rund statt eckig). "Alle löschen" sitzt oben rechts im
  Karten-Header über die `CardAction`-Komponente aus `ui/card.tsx` (nicht
  über `className="flex-row justify-between"` auf `CardHeader` – der ist
  standardmäßig `display: grid`, `flex-row` ohne `flex` hat dort keine
  Wirkung).
- Eigene Karte `settings-export-card.tsx` ("Export & Sicherung", 1:1 nach
  Bildvorlage) mit drei Zeilen: Zugriffsprotokoll (CSV,
  `GET /settings/changes/export`, `text/csv` mit UTF-8-BOM wie beim
  DSGVO-Bericht), Einstellungen als JSON (`GET /settings/export`, gibt
  das komplette `AppSettings`-Objekt ohne `id` **und ohne
  `smtpPasswordEncrypted`** zurück – Letzteres erst mit der SMTP-
  Erweiterung unten relevant geworden, ein JSON-Export ist kein
  vertrauenswürdiges Backup-Format) – beide echt. Der CSV-Export saß
  ursprünglich im Protokoll-Karten-Header, wurde aber auf
  Nutzerkorrektur in diese eigene Karte verschoben. "Vollständiger
  Inhaltsexport" bleibt deaktiviert, da Formular-Einsendungen kein
  reales Feature dieser App sind.
- AV-Vertrag-Dateien: `DataProcessorsService` löscht/ersetzt jetzt die
  verknüpfte `Media`-Datei mit (`MediaService.remove()`, Soft-Delete in
  den Papierkorb) statt sie verwaist liegen zu lassen. Der Button "AV-
  Verträge herunterladen" (Auftragsverarbeiter-Tab, Fußzeile rechts
  neben "Auftragsverarbeiter ergänzen") verschwindet automatisch, sobald
  kein Auftragsverarbeiter mehr eine Vertragsdatei hat – dafür geben
  `create()`/`update()` jetzt (wie schon `findAll()`) die
  `contractMedia`-Relation zurück, sonst blieb der Button nach
  Live-Änderungen ohne Neuladen fälschlich sichtbar/unsichtbar.

## Update 2026-08-22: Integrationen → Dienste, echter E-Mail-Versand (SMTP)

Nutzervorgabe: "lass uns jetzt email versand bauen unter einstellungen und
integration die settings dafür als dienst" (1:1 nach Bildvorlage
"Dienste"-Karte). Vorher versendete `MailerService` ausschließlich
Dev-Stub-Logeinträge (kein SMTP angebunden) – jetzt echter Versand, sobald
konfiguriert.

- Berechtigung bewusst per Rückfrage geklärt statt geraten (siehe
  [[feedback_ask_before_assigning_module_permissions]]): SMTP-Konfiguration
  hängt an `settings:*`, genau wie Webhooks seit 2026-08-21 – kein neues
  Recht `integrations:*`.
- `AppSettings` bekommt sechs neue Felder (`smtpHost`, `smtpPort`,
  `smtpUsername`, `smtpPasswordEncrypted`, `smtpFromAddress`,
  `smtpFromName`, `smtpSecure`, `smtpVerifiedAt`). Passwort liegt
  AES-256-GCM-verschlüsselt in der DB, nie im Klartext – der bisher
  TOTP-spezifische Helfer `common/utils/totp-encryption.ts` wurde dafür in
  `secret-encryption.ts` umbenannt und generisch gemacht
  (`encryptSecret`/`decryptSecret` statt `...TotpSecret`), `TwoFactorService`
  entsprechend angepasst. Gleicher Schlüssel `TOTP_ENCRYPTION_KEY` aus der
  `.env` (kein neuer env-Wert nötig, Name historisch, Funktion generisch).
- `smtpVerifiedAt` ist die einzige Statusquelle für "aktiv"/"offen" in der
  UI: jede Konfigurationsänderung setzt es auf `null` zurück,
  `SettingsService.updateSmtpSettings()` ruft direkt danach
  `MailerService.testConnection()` (`nodemailer`-`transporter.verify()`)
  auf und setzt bei Erfolg einen neuen Zeitstempel. Speichern schlägt bei
  falschen Zugangsdaten NICHT fehl (Config wird trotzdem persistiert,
  bleibt aber "offen") – der Fehler kommt als `testError` im PATCH-Response
  zurück und wird im "Einrichten"-Dialog inline angezeigt (`SystemMessage`,
  Variante `error`), damit man falsche Zugangsdaten nachträglich korrigieren
  kann, ohne von vorn anzufangen.
- Endpunkte: `GET/PATCH /settings/smtp` (Passwort im GET nie im Klartext,
  nur `hasPassword: boolean` – leeres Passwortfeld beim Speichern = altes
  Passwort behalten), `POST /settings/smtp/test-email` (schickt eine echte
  Mail an die eigene Konto-Adresse, unabhängig vom automatischen Test beim
  Speichern).
- **"Ja, alle umstellen" (Nutzerentscheidung):** Alle 8 bestehenden
  `MailerService`-Methoden (Verifikation, Passwort-Reset, DSB-Vorfall,
  DSB-Monatsbericht, Auskunft Art. 15, Löschanfrage-Bestätigung/-Rückfrage/
  -Fristerinnerung, AV-Vertrag-Anfrage) verschicken jetzt echte Mails über
  den konfigurierten SMTP-Server (gleicher Textinhalt wie vorher im
  Dev-Stub-Log, nur mit zusätzlichem Betreff; CSV-Berichte gehen als
  Anhang statt nur als Zeilenzahl im Text). Ohne SMTP-Konfiguration bleibt
  der Dev-Stub-Fallback (Logger-Eintrag) automatisch aktiv – kein Absturz,
  kein Unterschied für Umgebungen ohne SMTP.
- `settings-services-card.tsx` zeigt bewusst nur die eine echte Zeile
  "E-Mail-Versand (SMTP)" – "Reichweiten-Messung", "Suche", "Backup-Ziel"
  aus der Bildvorlage wurden NICHT ergänzt (kein Matomo/Such-Index/
  Backup-Ziel-Feature im Repo, kein erfundener Inhalt). Lokaler
  `useState` im Dialog-Ergebnis aktualisiert Badge/Button sofort ohne
  `router.refresh()` (gleiches Live-Update-Prinzip wie beim
  AV-Vertrag-Button).
- Protokoll: SMTP-Änderungen erscheinen als "E-Mail-Versand (SMTP)
  geändert" im "Protokoll"-Tab (`action: 'settings.smtp_updated'`,
  `FIELD_LABELS.emailSmtp`) – bewusst ohne `before`/`after`-Werte in den
  Metadaten (Host/Port sind nicht sensibel, aber ein eigener Diff lohnt
  sich für ein einzelnes Dienst-Objekt nicht wie bei Einzelfeldern).
- **Bugfix, gleicher Tag:** "Testmail senden" schickte ursprünglich immer
  an `user.email` aus dem JWT – also die im Pivot-Konto hinterlegte
  Adresse des eingeloggten Nutzers. Nutzer-Bugreport: "ich habe die
  testmail versendet, bekomme sie nicht, obwohl erfolgreich meldung
  kommt" – der Versand war tatsächlich erfolgreich, ging aber an
  `admin@pivot.dev` (Seed-Account dieser Installation), nicht an die
  echte, vom Nutzer kontrollierte Adresse. Jetzt eigenes Eingabefeld
  "Testmail senden an" im Dialog, Zieladresse geht explizit im
  Request-Body mit (`SendSmtpTestEmailDto`), keine Kontoadresse mehr
  automatisch verwendet.

## Update 2026-08-22: Platzhalter "Mail-Absender" entfernt

Rückfrage "mailabsender bei benachrichtigungen, brauchen wir das noch?"
→ Nutzerentscheidung: nein, entfernen. Die Platzhalter-Karte
"Mail-Absender" im "Benachrichtigungen"-Tab (Absenderadresse/-name,
"in Vorbereitung") ist mit der SMTP-Karte unter Integrationen → Dienste
(siehe oben) jetzt tatsächlich gebaut und redundant geworden. Entfernt
aus `settings-form.tsx`, Sidebar-Untertitel bei "Benachrichtigungen" von
"Absender & Systemmails" auf "Systembenachrichtigungen" geändert – der
Tab enthält jetzt nur noch die echten Ein/Aus-Schalter
(`NotificationSettingsCard`).

## Update 2026-08-23: neuer Reiter "Mailing"

Nutzervorgabe (Formulare + Mailing, siehe
[knowledge-base/content/forms.md](../content/forms.md)): ein neuer
`SECTIONS`-Eintrag "Mailing" zwischen "Jobs" und "Protokoll", eigenes
Recht bewusst NICHT nötig (`settings:*`, Pivot-exklusiv wie der Rest der
allgemeinen Einstellungen). Neue Komponente `mailing-settings-card.tsx`:
links eine nach Kategorie gruppierte Liste (System-Mails nach
auth/privacy + eine "Formulare"-Gruppe mit den formulargebundenen
Vorlagen), rechts Detail mit "Versand aktiv"-Schalter, Tabs
"Vorlage"/"Vorschau" (+ "Empfänger"-Tab nur bei der Formular-
Admin-Benachrichtigung, da einzige Vorlage mit editierbarem Empfänger).
`settings/page.tsx` lädt die Liste über `getMailTemplates()`
(`GET /settings/mail-templates`) und reicht sie als `mailTemplates`-Prop
durch – gleiches Prinzip wie `jobs`/`jobRuns`.

**Kein URL-Query-Param für `activeSection`:** anders als z.B. die
Protokoll-/Jobs-Paginierung (`?protocolPage=`/`?jobsPage=`) ist der aktive
Reiter selbst reiner `useState`, nicht in der URL gespiegelt. Ein
Deep-Link auf "direkt zum Mailing-Reiter dieses Formulars" (aus dem
Formular-Editor, Tab "Benachrichtigung") ist dadurch nicht möglich – der
Link dort führt nur auf die allgemeine Einstellungen-Seite.

## Update 2026-08-31: zweistufige Gruppen-Navigation

Die bis dahin flache Liste von 13 Bereichen in der Sidebar war zu lang
geworden und wurde in eine **zweistufige Navigation** umgebaut (Vorgabe
per Bildvorlage):

- **Ebene 1 (links, `xl:w-60`)** – Themengruppen (`GROUPS` in
  `settings-form.tsx`): Allgemein, Sicherheit, Verbindungen, Betrieb,
  Labor sowie die nur auf dem Master sichtbare Gruppe (`masterOnly`,
  gefiltert über `settings.deploymentMode === "master"`). Ein Klick auf
  eine Gruppe setzt `activeSection` auf deren **ersten** Bereich.
- **Ebene 2 (rechts, `lg:w-64`, gleich breit wie Ebene 1)** – die Bereiche der aktiven Gruppe,
  darüber der Gruppenname als kleine Uppercase-Überschrift. Der aktive
  Bereich bekommt zusätzlich ein `ChevronRight`-Icon (per `self-center`
  mittig zum Text, nicht an der ersten Zeile ausgerichtet).
- **Master-Client bleibt bewusst unter "Verbindungen"** statt in der
  master-only Gruppe: der Bereich ist auf Slave-Installationen ebenfalls
  relevant (zeigt dort Lizenz-/API-Key-Status statt der Mandantenliste).

**Optik (Nutzervorgabe 2026-08-31, mehrfach nachgeschärft):**

- Beide Ebenen liegen in **einer** Karte
  (`overflow-hidden rounded-xl bg-card shadow-sm lg:flex`), nicht in zwei
  eigenen Karten mit Abstand. Dadurch sind die Ecken **nur außen**
  abgerundet und beide Ebenen haben durch das Flex-Stretch **immer
  dieselbe Höhe**, unabhängig davon, wie viele Einträge die aktive
  Gruppe hat.
- Ebene 1 liegt visuell **über** Ebene 2: `relative z-10` plus ein
  gerichteter Schatten nach rechts
  (`lg:shadow-[5px_0_14px_-9px_rgba(0,0,0,0.10)]`) – eine normale
  `shadow-*`-Utility wäre hier falsch, die wirft nach unten und würde
  vom `overflow-hidden` der Außenkarte weggeschnitten. Der Trenner
  bleibt zusätzlich als `lg:border-r`.
- Nur Ebene 1 hat den grünen Aktiv-Balken links (`border-l-4
border-l-primary`); **Ebene 2 hat bewusst keinen** – dort markiert nur
  die `bg-primary/15`-Fläche plus Chevron den aktiven Bereich.
- Auf Mobil (`< lg`) stapeln sich beide Ebenen innerhalb derselben Karte,
  getrennt durch `border-t`; Breiten und Seitenschatten sind
  `lg:`-gebunden.

**Responsive-Korrektur (Nutzervorgabe 2026-08-31, "mobil optimierung
durchführen und immer überall beachten"):** Navigationskarte und
Inhaltsspalte stehen erst ab `xl` nebeneinander, nicht schon ab `lg` –
zwei feste 256px-Spalten plus Inhalt passen zwischen 1024px und ~1400px
nicht nebeneinander, die Inhaltskarte wurde dort zusammengequetscht
(abgeschnittene Überschriften, ein auf drei Zeichen geschrumpftes
E-Mail-Feld). Zwischen `lg` und `xl` liegt die Navigationskarte deshalb
als eigener, zweispaltiger Block **über** dem Inhalt und nimmt dort auf
Nutzervorgabe die **volle Breite mit 50/50 geteilten Ebenen** ein
(`lg:w-1/2` je Ebene, erst ab `xl` wieder feste Breiten: Ebene 1 `xl:w-60`, Ebene 2 etwas breiter mit `xl:w-68`). Zusätzlich:
`break-words` auf den Textspalten beider Ebenen (das lange Wort
"Systembenachrichtigungen" lief sonst unter den Chevron), und die
Empfänger-Zeile in `notification-settings-card.tsx` ist
`flex-col sm:flex-row` statt einer festen Zeile.

## Offene Punkte

- Datenschutz-Feldänderungen (DPO-Kontakt, Aufbewahrungsfristen) haben
  weiterhin keine eigene Änderungshistorie.
- Inhalte für Datenschutz-Zusatz und Benachrichtigungen (SMTP-Absender)
  folgen als eigene, spätere Ausbauschritte (jeweils eigene Rückfrage
  nötig, da diese Bereiche echte neue Backend-Features bräuchten, nicht
  nur UI). Integrationen hat seit 2026-08-21 mit Webhooks einen ersten
  echten Inhalt, API-Schlüssel bleiben offen.
- Kein Playwright-Test für den "Verwerfen"-Button auf die
  Firmenfelder/Speicherkontingent (nur der Switch-Reset wurde end-to-end
  verifiziert; die lokalen String-States nutzen dieselbe
  `handleDiscard()`-Funktion, Logik ist aber ungetestet).

## Update 2026-08-31: Mailing ist eine eigene Gruppe – ohne zweite Ebene

Mailing lag als Bereich in Ebene 2 unter "Verbindungen" und hatte im
Inhalt zusätzlich eine eigene Reiterleiste (Vorlagen | E-Mail-Templates) –
also drei Navigationsebenen übereinander. Es wurde zunächst in eine
eigene Gruppe **mit** zwei Ebene-2-Bereichen aufgeteilt; die
Nutzerkorrektur direkt danach: "Vorlagen und E-Mail-Template als Tab. Es
soll bei Mailing keine 2te Ebene Sidebar geben."

**Endstand:**

- `Mailing` ist eine eigene Gruppe in Ebene 1 (`GROUPS`), "Verbindungen"
  führt nur noch Integrationen, Webhooks und Master-Client.
- Die Gruppe hat **genau einen** Bereich (`sections: ["mailing"]`); die
  Reiterleiste in `mailing-settings-card.tsx` bleibt unverändert
  bestehen.
- Neu in `settings-form.tsx`: `showSectionColumn = activeGroup.sections.
length > 1`. Gruppen mit nur einem Bereich rendern **keine zweite
  Sidebar-Spalte** – eine Spalte mit einem einzigen Eintrag würde nur den
  Gruppennamen wiederholen. Ebene 1 nimmt dann die volle Kartenbreite ein
  und verzichtet auf Trennlinie und Seitenschatten.
- **Gilt damit automatisch auch für "Sicherheit" und "Administration"**,
  die ebenfalls nur einen Bereich haben. Das ist beabsichtigt, war aber
  nicht ausdrücklich angefragt – bei Bedarf lässt es sich über ein Flag
  auf Mailing beschränken.

**Direkt danach dasselbe für Jobs** ("gleiche bei Jobs"): `Jobs` ist jetzt
ebenfalls eine eigene Gruppe mit einem einzigen Bereich und damit ohne
zweite Sidebar-Spalte. "Betrieb" führt nur noch Wartungsseite,
Benachrichtigungen und Protokoll – der Untertitel der Gruppe wurde von
"Jobs, Wartung, Protokoll" auf "Wartung & Protokoll" korrigiert, sonst
hätte er auf einen Bereich verwiesen, der dort nicht mehr liegt.
Reihenfolge in Ebene 1: Allgemein, Sicherheit, Verbindungen, Mailing,
Betrieb, Jobs, Administration.

**Perspektive:** der SMTP-Versand liegt weiterhin unter Integrationen →
Dienste. Fachlich gehört er in diese Gruppe; das Verschieben wäre ein
eigener Schritt, weil die Dienste-Karte mehrere Dienste bündelt.

## Update 2026-09-02: "Vollständiger Inhaltsexport" ist echt

Die dritte Zeile in "Export & Sicherung" war seit 2026-08-22 ausgegraut
mit der Begründung, Formular-Einsendungen seien kein reales Feature dieser
App. Seit dem Formulare-Feature stimmt das nicht mehr – Nutzervorgabe
2026-09-02: "umsetzen".

`GET /settings/content-export` liefert die redaktionellen Inhalte dieser
Installation als ein JSON: Seiten inkl. Bausteinen und SEO, Kategorien,
Tags, Menüs, globale Module (Galerien/FAQs), Formulare **mit ihren
Einsendungen** und Medien-Metadaten. Dazu ein `meta`-Block mit Zeitpunkt
und einer ausdrücklichen `excludes`-Liste sowie `counts` je Bereich.

**Bewusst nicht enthalten** – und das steht im Export selbst, damit es
niemand raten muss, der ihn später in die Hand bekommt:

- die Mediendateien (nur Metadaten; ein ZIP wäre ein eigenes Feature)
- Benutzerkonten und Sitzungen
- Einstellungen (haben ihren eigenen Export direkt daneben)
- Papierkorb-Einträge – ein Export ist eine Momentaufnahme dessen, was die
  Installation zeigt

**Personenbezogene Daten:** die Einsendungen enthalten sie. Deshalb
verlangt die Route `settings:read` (in dieser App die Pivot-Rolle) und der
Aufruf wird protokolliert (`settings.content_exported`, deutsche
Beschriftung ergänzt) – mitsamt den Stückzahlen, damit im Protokoll steht,
wie viel herausgegangen ist, nicht nur dass exportiert wurde. Der
Hinweistext in der Zeile sagt beides offen.

## Update 2026-09-05: "Frontend" wird eigener Oberpunkt mit drei Bereichen

Nutzervorgabe: _"das frontend will ich als eigenen punkt haben. also als
oberpunkt"_, danach die Entscheidung für Unterpunkte statt einer einzigen
Karte.

Vorher hing "Frontend" als dritter Bereich unter "Allgemein" und trug
alles in einer Karte: Titel, Untertitel, Favicon, Social-Bild, Basis-URL,
SEO-Beschreibung, Seitenabstand (drei Reiter), Startseiten-Schalter, drei
Menüs und die Footer-Zeile. Über zehn Felder in einer Karte, mit weiterem
Wachstum absehbar.

Jetzt: eigene Gruppe `frontend` mit drei Bereichen –

| Bereich            | Inhalt                                                                 |
| ------------------ | ---------------------------------------------------------------------- |
| Grundlagen & SEO   | Titel, Untertitel, Favicon, Social-Bild, Basis-URL, SEO-Beschreibung   |
| Darstellung        | Abstand der Seite (Mobil/Tablet/Desktop) + Schalter für die Startseite |
| Kopf- & Fußbereich | Hauptmenü, zwei Footer-Menüs, Footer-Zusatzzeile                       |

Anders als Caching, Jobs und Mailing (eigene Gruppe mit **einem** Bereich
und deshalb ohne zweite Sidebar-Spalte) bekommt Frontend die zweite Ebene
– genau dafür ist `showSectionColumn` da.

Der bisherige Bereich "Darstellung" unter _Allgemein_ heißt seitdem
**"Darstellung Backend"** (Nutzervorgabe): sonst stünde dieselbe
Beschriftung zweimal in derselben Sidebar – einmal für die Verwaltung,
einmal für die öffentliche Webseite.

**Beim Erweitern beachten:** ein neues Feld gehört in den Bereich, dessen
Frage es beantwortet ("wie heißt die Seite" / "wie sieht sie aus" / "was
steht im Kopf und Fuß"), nicht ans Ende der ersten Karte. Die alte Karte
war genau so gewachsen.
