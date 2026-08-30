# Formulare + Mailing

**Datum:** 2026-08-23
**Betroffene Bereiche:** apps/api, apps/web, packages/database

## Was wurde gebaut

Zwei neue, miteinander verzahnte Bereiche:

1. **Formulare** (`/dashboard/forms`, Sidebar-Gruppe "Webseite"): eigene
   Formulare mit einem Feld-Builder anlegen (Basis: text/textarea/email/
   tel/number, Auswahl: select/radio/checkbox mit `options`, Erweitert:
   date; `file` ist nur strukturell im Backend-Katalog vorgesehen, bewusst
   **nicht** im Editor-Palette wählbar, da es ohne Upload-Handling ein
   nicht ausfüllbares Pflichtfeld erzeugen würde). Ein Formular hat einen
   Status (`draft`/`published`/`paused`), landet als eigener
   Seiten-Designer-Baustein "Formular" auf Seiten und sammelt Einsendungen
   (`FormSubmission`), die pro Formular oder app-weit unter
   "Einsendungen" einsehbar sind (gelesen/gelöscht werden können).
2. **Mailing** (Einstellungen → Mailing, Pivot-exklusiv `settings:*`):
   eine einzige Liste aus **allen** Mail-Vorlagen der App – die acht
   bestehenden System-Mails mit festem Wortlaut (Verifikation,
   Passwort-Reset, DSB-Vorfall/Monatsbericht, Auskunft Art. 15,
   Löschanfrage-Bestätigung/Fristerinnerung, AV-Vertrag-Anfrage) UND die
   beiden Vorlagen jedes Formulars (Admin-Benachrichtigung + Bestätigung
   an den Absender). Pro Vorlage: "Versand aktiv"-Schalter, Betreff/Text
   mit klickbaren Platzhalter-Chips, Testmail-Versand, Vorschau-Tab,
   "Auf Standard zurücksetzen".

Zwei bisher wirkungslose Datenschutz-Einstellungen wurden dadurch aktiv:
`dsbFormStoreSubmissionIp` (steuert, ob `FormSubmission.submitterIp`
befüllt wird) und `retentionFormSubmissionsDays` (wird als "Abgelaufen"-
Badge in beiden Einsendungen-Listen ausgewertet – **Löschen bleibt bewusst
manuell**, kein Hintergrund-Autolöschen, gleiche Konvention wie überall
sonst in dieser App). `dsbFormSelfServiceDisclosure` bleibt weiterhin
wirkungslos (nicht Teil dieser Ausbaustufe).

## Warum diese Lösung

- **Eigenes Datenmodell statt `GlobalModule`:** Galerie/FAQ (`GlobalModule`)
  wurden für stark repeater-lastige, "viele Werte in einem JSON-Blob"-
  Inhalte bereits einmal als generische Lösung verworfen (siehe
  [faq-and-gallery-dedicated-pages.md](./faq-and-gallery-dedicated-pages.md)).
  Formulare brauchen zusätzlich ein Konzept, das `GlobalModule` gar nicht
  kennt: viele Einsendungen zu einer Definition. Daher drei neue,
  dedizierte Prisma-Modelle: `Form`, `FormSubmission`, `MailTemplate`.
- **Eine gemeinsame `MailTemplate`-Tabelle für System-Mails UND
  Formular-Vorlagen:** Nutzervorgabe, beides unter Mailing zusammen
  bearbeitbar zu haben. `key` (fester Code-Schlüssel, z.B.
  `"auth.verify-email"`) ODER `formId`+`formKind`
  (`"admin_notification"`/`"confirmation"`) – genau eines ist pro Zeile
  gesetzt, erzwungen über `@@unique([formId, formKind])` plus die
  Anwendungslogik in `MailerService`.
- **Kein Seed für Mail-Vorlagen-Inhalte:** Der Plan sah zunächst vor, die
  acht System-Vorlagen mit dem bisherigen Wortlaut in die DB zu seeden.
  Umgesetzt wurde stattdessen ein reiner Code-Fallback
  (`SYSTEM_MAIL_TEMPLATES` in `mail-templates.catalog.ts`): ohne eigene
  DB-Zeile liefert `MailerService.renderSystemTemplate()` exakt diesen
  Standardtext. Ein Seed hätte denselben Text an zwei Stellen gepflegt
  (Code-Fallback UND DB-Zeile) und wäre die zweite Quelle geworden, die
  bei einer künftigen Textänderung vergessen werden kann. "Auf Standard
  zurücksetzen" ist dadurch simpel: DB-Zeile löschen.
- **`GET /forms/stats`:** eigener Aggregations-Endpunkt für die drei
  Stat-Kacheln der Übersicht (Formulare nach Status, Einsendungen letzte
  30 Tage, unbearbeitet) – ohne ihn wären die Kacheln nur über die
  aktuell sichtbare (paginierte) Seite korrekt gewesen.
- **Neuer `ContentTypeField`-Typ `"form"` für den Seiten-Designer-Baustein:**
  Der Block-Editor kennt keine "Blocktypen" im klassischen Sinn – jeder
  Baustein ist ein per Seed gepflegter `ModuleType` mit einem
  `ContentTypeField[]`-Schema; Galerie/FAQ werden rein strukturell erkannt
  (Repeater mit/ohne Bild-Unterfeld), nicht über einen eigenen Code-Pfad.
  Für "referenziere ein Formular per Id" gab es keine passende bestehende
  Struktur (kein Repeater, keine `GlobalModule`-Referenz), daher ein neuer
  Feldtyp `"form"` (Wert = `Form.id`, analog zur `globalModuleId`-Referenz
  bei Galerie/FAQ, aber als eigener Feldtyp statt über "modules"). Diese
  Entscheidung wurde dem Nutzer als Frage vorgelegt (Alternative: Formulare
  ohne Seiten-Designer-Anbindung ausliefern), er hat sich für den neuen
  Feldtyp entschieden.
- **`GET /forms/public/:id` + `POST /forms/:slug/submit`, beide `@Public()`:**
  Der Formular-Baustein muss auch auf der anonymen Vorschau-Seite
  (`/preview/[token]`) funktionieren, die ohne Login auskommen muss. Beide
  Endpunkte geben bewusst nur das Nötigste preis (keine Einsendungen,
  keine internen Einstellungen) und funktionieren nur für
  `status: "published"`-Formulare.

## Empfänger-Logik

- **Admin-Benachrichtigung:** `MailTemplate` mit
  `formKind: "admin_notification"` hat ein editierbares `recipientTo`
  (siehe `recipientEditable: true` in `MailerService.listMailTemplates()`).
  Leer = gemeinsame Adresse (`AppSettings.notificationRecipientEmail`),
  gesetzt = eigene Adresse. Wird im Formular-Editor (Tab
  "Benachrichtigung") als Radio-Auswahl angeboten, landet aber technisch
  auf der Mail-Vorlage, nicht auf `Form` selbst.
- **Bestätigung an Absender:** geht an den Wert des als `emailFieldId`
  markierten Formularfelds – nur sendbar, wenn `Form.sendConfirmation`
  aktiv UND ein E-Mail-Feld gewählt ist (`FormsService.submit()` prüft
  beides). Empfänger ist hier bewusst NICHT editierbar
  (`recipientEditable: false`), da er strukturell vom Absender selbst
  kommt.
- **Alle anderen System-Mails** haben einen kontextabhängigen, fest
  bestimmten Empfänger (Passwort-Reset → anfragender Nutzer, DSB-Mails →
  DSB-Kontakt, …) – dafür bewusst kein editierbares Empfänger-Feld in der
  Mailing-UI (`recipientEditable: false`, kein "Empfänger"-Tab).

## Bewusst nicht gebaut

- **Datei-Upload-Felder** (`file`-Typ existiert nur strukturell im
  Backend-Katalog, kein Upload-Handling, nicht im Editor wählbar) – ein
  öffentlicher, unauthentifizierter Datei-Upload braucht eigene
  Sicherheits-/Größenbetrachtung.
- **Formular-Abschlussrate/Analytics** – bräuchte Tracking von
  Formular-*Aufrufen*, nicht nur Absendungen (neues, DSGVO-relevantes
  Thema für sich).
- **CC/Antwort-An/Sammelmail-Digest, Empfänger-Gruppen nach Rolle/
  Standort, Zustellprotokoll pro Einzelversand** – deutlich mehr Umfang
  als für den beschriebenen Bedarf nötig, bei Bedarf später nachrüstbar.
- **Zwei bestehende Mail-Methoden bekamen KEINE Vorlage:**
  `sendDeletionRequestFollowUp` (Admin tippt die Rückfrage frei im
  Popup, kein fester Standardtext) und `sendSystemNotificationEmail`
  (Titel/Text kommen bereits fertig formuliert aus
  `NotificationsService`) – eine "Vorlage" hätte dort nichts Sinnvolles,
  über das der Aufrufer hinaus als Standard existiert.

## Berechtigungen

`forms:read/create/update/delete` + `form-submissions:read/delete`,
Kategorie `extensions` (wie `gallery`/`faq`) – Pivot/Administrator/Manager
bekommen sie automatisch über die volle `PERMISSIONS`-Liste (minus ihrer
jeweiligen Ausnahmen, die Forms nicht betreffen), Redakteur bekommt sie
NICHT (gleiche Behandlung wie Galerie/FAQ, die Redakteur ebenfalls nicht
hat). Mailing braucht kein eigenes Recht (`settings:*`, Pivot-exklusiv).

## Papierkorb-Integration

`Form` hat dieselben Soft-Delete-Felder wie Content/Media/Category/Tag/
GlobalModule (`deletedAt`/`deletedById`) und ist als siebter Typ in
`TRASH_TYPES` (`apps/api/src/trash/trash.types.ts`) registriert –
`TrashService.serviceFor()`/`collect()` haben einen `forms`-Fall,
`trash-view.tsx` einen `forms`-Eintrag in `TYPE_FILTERS`/`TYPE_LABELS`/
`TYPE_STYLES`. `MailTemplate`+`FormSubmission` hängen per
`onDelete: Cascade` an `Form` – ein endgültig gelöschtes Formular nimmt
seine Einsendungen und Vorlagen automatisch mit.

## Relevante Dateien

**Backend:**
- `apps/api/src/forms/` (forms.service.ts, forms.controller.ts,
  forms.module.ts, form-field.types.ts, dto/*)
- `apps/api/src/mailer/mailer.service.ts`,
  `apps/api/src/mailer/mail-templates.catalog.ts`
- `apps/api/src/settings/settings.controller.ts` (Mailing-Endpunkte),
  `apps/api/src/settings/dto/update-mail-template.dto.ts`
- `apps/api/src/trash/trash.types.ts`, `apps/api/src/trash/trash.service.ts`
- `apps/api/src/roles/permissions.catalog.ts`,
  `packages/database/prisma/seed.ts` (Rechte + neuer Baustein "Formular")
- `packages/database/prisma/schema.prisma` (`Form`, `FormSubmission`,
  `MailTemplate`)

**Frontend:**
- `apps/web/src/app/dashboard/forms/**` (Übersicht, Editor, Einsendungen)
- `apps/web/src/components/forms-view.tsx`, `form-editor.tsx`,
  `form-create-dialog.tsx`, `form-row-actions.tsx`, `submissions-table.tsx`
- `apps/web/src/components/mailing-settings-card.tsx`,
  `apps/web/src/components/settings-form.tsx` (neuer Mailing-Reiter)
- `apps/web/src/components/module-field-input.tsx` (Feldtyp `"form"`,
  Formular-Picker im Block-Editor)
- `apps/web/src/components/block-field-output.tsx` +
  `apps/web/src/components/form-block-render.tsx` (Feldtyp `"form"`,
  öffentliches, absendbares Formular)
- `apps/web/src/app/api/forms/**`,
  `apps/web/src/app/api/settings/mail-templates/**` (BFF-Routen)
- `apps/web/src/components/app-sidebar.tsx` (Sidebar-Eintrag "Formulare"),
  `apps/web/src/components/trash-view.tsx` (Papierkorb-Typ `forms`)

## Verifizierung

Live gegen die laufende Dev-API getestet (geminteter JWT, echtes SMTP
bereits konfiguriert): Formular anlegen → veröffentlichen → öffentlicher
Baustein-Fetch (`/forms/public/:id`) → Absenden (`/forms/:slug/submit`) →
`FormSubmission` angelegt, Admin-Benachrichtigung UND Bestätigung an
Absender kamen mit korrekt ersetzten Platzhaltern an (inkl. Firmen-
Fußzeile aus `deliver()`). Eigene Empfänger-Adresse auf der
Admin-Vorlage getestet (überschreibt die gemeinsame Adresse korrekt).
Pause-Schalter getestet: `enabled:false` → Testmail via
"Testmail senden" wird trotzdem verschickt (bewusst, siehe
`ignoreEnabled`), der reguläre Auslöser (`sendVerificationEmail` etc.)
überspringt den Versand. "Auf Standard zurücksetzen" getestet (DB-Zeile
gelöscht, Standardtext wieder aktiv). Papierkorb-Rundlauf getestet
(löschen → erscheint unter `type=forms` → wiederherstellen →
endgültig löschen). App-weite und pro-Formular Einsendungen-Liste
getestet (inkl. gelabelter Feldwerte über das mitgelieferte
`form.fields`). Alle Test-Daten anschließend wieder entfernt.

Frontend-Seiten (Formulare-Übersicht/-Editor/-Einsendungen, Mailing-Tab)
sind NICHT per Browser getestet worden (kein Headless-Browser in dieser
Session verfügbar) – nur Typecheck/ESLint sauber. Bitte im Browser
gegenprüfen, insbesondere: Feld-Builder (Drag ist NICHT implementiert,
nur Auf/Ab-Pfeile), Mailing-Platzhalter-Chips (Cursor-Einfügen), das
öffentliche Formular im Seiten-Designer-Baustein.

## Update 2026-08-23: Editor nach Bildvorlage überarbeitet

Nutzervorgabe mit Referenzbild ("Neues Formular"/Bearbeiten-Ansicht) –
mehrere Abweichungen vom ursprünglichen Erstentwurf:

- **Kein Anlegen-Dialog mehr.** "+ Formular erstellen" führt direkt auf
  `/dashboard/forms/new`, eine Instanz von `FormEditor` mit `form={null}`
  (Create-Modus). Name/Slug haben sinnvolle Vorgabewerte ("Neues
  Formular"/"neues-formular"), Speichern läuft als `POST /forms` statt
  `PATCH`.
- **Neuer Feldtyp `"section"` ("Abschnitt")** – rein darstellend (Titel +
  Hinweistext, kein Eingabewert, keine Pflichtfeld-Option), gliedert
  längere Formulare. Ein neues Formular startet mit genau einem
  vorbefüllten Abschnitt-Feld ("Ihre Anfrage" /
  "Wir melden uns innerhalb von 24 Stunden.") statt leer zu sein.
  Rein darstellende Felder werden in `defaultFormTemplate()`/
  `formFieldPlaceholders()` (`mail-templates.catalog.ts`) und
  `fieldValuesToStrings()` (`forms.service.ts`) übersprungen – sie hätten
  sonst leere `{{id}}`-Platzhalter erzeugt.
- **Jedes Feld hat jetzt optional `helpText`** (kleine Erläuterung unter
  dem Titel, bei `section` der eigentliche Inhalt) – neues Feld auf
  `FormField`/`FormFieldOption` und `FormFieldDto`.
- **Feld-ID ist nicht mehr frei editierbar**, nur noch als graue,
  informative Box angezeigt (`generateFieldId()` vergibt sie beim
  Hinzufügen). Reduziert das Risiko, versehentlich eine ID zu ändern, auf
  die eine bereits gespeicherte Mail-Vorlage als Platzhalter verweist.
- **Ein einziger primärer Button** ("Speichern & veröffentlichen" bzw.
  nur "Speichern", wenn bereits `status: "published"`) statt der
  bisherigen Status-Pillen im Header – setzt bei Bedarf automatisch
  `status: "published"` mit. Die Status-Pillen (Entwurf/Live/Pausiert)
  gibt es weiterhin, jetzt im Tab "Einstellungen" (nur bei bestehenden
  Formularen, nicht beim Neuanlegen) – einzige Möglichkeit, ein Formular
  wieder zu pausieren oder auf Entwurf zurückzusetzen.
- **Live-WYSIWYG-Canvas statt abstrakter Feld-Liste:** Die mittlere Spalte
  zeigt Name/Slug-Kopfzeile + die tatsächlich gerenderten Felder (disabled
  Vorschau-Controls, `FieldPreviewControl`) + eine feste Fußzeile
  ("Ihre Daten werden verschlüsselt übertragen." + deaktivierter
  "Absenden"-Button) – dieselbe `FormCanvas`-Komponente wird auch im neuen
  "Vorschau"-Dialog verwendet (ohne Auswahl-Overlay).
- **Echtes Umsortieren per Pfeiltasten** (nicht nur Auf/Ab-Buttons): ein
  fokussiertes Feld im Canvas reagiert auf ArrowUp/ArrowDown – der grüne
  Hinweistext links in der Palette beschreibt jetzt tatsächliche
  Funktionalität statt nur der (entfernten) Buttons.
- **"Feld entfernen"-Button auf `variant="outline"` mit rotem Text**
  (`border-[#D4D4D4] text-destructive hover:bg-destructive/5`) korrigiert
  – die ursprüngliche gefüllte `variant="destructive"`-Version widersprach
  der App-weiten Konvention für sekundäre Lösch-Aktionen (siehe z.B.
  `settings-protocol-card.tsx`, `user-edit-view.tsx`).

## Update 2026-08-23: Standard-Komponenten statt Ad-hoc-Nachbauten

Scharfe Nutzer-Rückmeldung ("warum wendest du nicht den standard an?"),
nachdem der Editor mehrfach mit selbst gebauten Bedienelementen statt
bestehender Komponenten ausgestattet wurde:

- **`SegmentedPicker` statt selbst gebauter Pillen-Auswahl.** Vier Stellen
  im Formular-Editor hatten je eine eigene, leicht abweichende Kopie
  desselben `flex gap-1 rounded-lg bg-[#F4F4F5] p-1`-Musters (Basis/
  Auswahl/Erweitert-Umschalter in der Palette, Halb/Voll-Breite,
  Entwurf/Live/Pausiert-Status) – dafür gibt es bereits
  `segmented-picker.tsx` (genutzt in `content-editor-form.tsx`,
  `privacy-view.tsx`, `settings-form.tsx` für exakt diesen Anwendungsfall:
  Status, Tabellendichte, Aufbewahrungsfristen). Alle vier durch
  `<SegmentedPicker>` ersetzt.
- **Kein natives `<input type="radio">` für "Admin-Benachrichtigung an".**
  Auch hier war `SegmentedPicker` (zwei Optionen: Gemeinsame Adresse/
  Eigene Adresse) die richtige, bereits vorhandene Lösung statt eigener
  Radio-Buttons mit `accent-primary` (sah je nach Browser/OS uneinheitlich
  aus, siehe Nutzer-Screenshot).
- **Info-Hinweisbox ohne fetten Text.** `ui/system-message.tsx` setzt
  `title` IMMER fett (`font-semibold`) – für einen einzeiligen, beiläufigen
  Tipp ("Felder lassen sich ... umsortieren") ist das der falsche Slot.
  Die Box übernimmt jetzt zwar exakt dieselben Lime-Farbwerte wie
  `SystemMessage`s "info"-Variante (`border-lime-200 bg-lime-50` +
  `text-lime-700`-Icon), aber als eigenständiges, schlankes Markup mit
  normal gewichtetem `text-muted-foreground`-Text statt der vollen
  `SystemMessage`-Komponente – die eignet sich für echte, mehrzeilige
  Statusmeldungen mit Titel, nicht für einzeilige Tipps.
- **Grid-Spalten strecken sich sonst auf die höchste Nachbarspalte:** Der
  3-Spalten-Container hatte kein `items-start`, wodurch die kürzere
  Palette-Kachel (links) sich per CSS-Grid-Default (`align-items: stretch`)
  auf die Höhe der höheren Canvas-/Eigenschaften-Kachel aufblähte – mit
  sichtbar leerem Weißraum am unteren Rand. Fix: `items-start` auf dem
  Grid-Container.
- **Echtes Ziehen&Ablegen zum Umsortieren** (Nutzervorgabe: "die felder ...
  müssen drag and drop haben") – exakt dasselbe native HTML5-DnD-Muster
  wie `gallery-editor.tsx` (`draggable`, `onDragStart`/`onDragOver`/
  `onDragLeave`/`onDrop`, `draggedId`/`dragOverId`-State, Ziel-Ring beim
  Drüberziehen). Pfeiltasten-Umsortieren bleibt zusätzlich erhalten
  (Barrierefreiheit) – `FormCanvas` bekam dafür zwei getrennte Props
  (`onReorderStep` fürs eine, `onReorderDrop` fürs andere), statt eines
  überladenen einzelnen Props.

**Lehre für künftige UI-Arbeit in diesem Bereich:** vor dem Bau eines
neuen Auswahl-/Umschalt-Elements immer zuerst in
`apps/web/src/components/` nach einem bereits bestehenden, genau dafür
gedachten Baustein suchen (hier: `segmented-picker.tsx`), statt eine
Bildvorlage 1:1 mit frei erfundenem Tailwind nachzubauen – "1:1 nach
Bildvorlage" heißt Look, nicht zwingend "neue Implementierung".

## Update 2026-08-23: Stufenlose Breite per Zieh-Griff + Inline-Entfernen

Nutzervorgabe: "ich will es in der breite ändern und elemente ... durch
drag and drop kleiner ziehen und so nebeneinander haben" + "füge element
entfernen hinzu".

- **`FormField.width` ist jetzt `number` (10-100), nicht mehr
  `"half" | "full"`** – gleiche Konvention wie `ImageFieldValue.width` im
  Seiten-Designer-Bild-Baustein. Betroffen: `form-field.types.ts`
  (Backend), `form-field.dto.ts` (`@IsInt() @Min(10) @Max(100)` statt
  `@IsIn(['half','full'])`), `api-server.ts` (`FormFieldOption.width`).
- **Layout von CSS-Grid auf `flex flex-wrap` umgestellt**
  (`form-block-render.tsx` UND `form-editor.tsx`s Aufbau-Canvas): jedes
  Feld bekommt `className="w-full sm:w-[var(--field-w)]"` +
  `style={{ "--field-w": `${field.width}%` }}` – mobil (< `sm`) immer
  volle Breite (siehe [[feedback_always_responsive]]), ab `sm` die
  eingestellte Prozent-Breite. Reihen sich dadurch automatisch
  nebeneinander ein, sobald die Summe einer Zeile ≤ 100% ist – exakt wie
  gewünscht ("... und so nebeneinander haben").
- **Zieh-Griff zum Verkleinern/Vergrößern** im Aufbau-Canvas: identisches
  Muster wie der Bild-Baustein-Resize in `block-editor-field.tsx`
  (`startResize`, `pointermove`/`pointerup` auf `window`, oranger Griff
  unten rechts, erscheint nur bei Hover). Referenzbreite ist die Breite
  der Feld-Reihe (`rowRef`), nicht die Breite des einzelnen Felds selbst.
  Minimum 20%, Maximum 100%. Die Eigenschaften-Panel-Kachel behält
  zusätzlich `SegmentedPicker`-Schnellauswahl (Halb=50/Voll=100) plus
  Live-Prozent-Anzeige – beide Wege schreiben auf dasselbe Feld.
- **Inline "Feld entfernen"-Button direkt im Canvas** (Hover, oben rechts
  am Feld, schwarzer Kreis mit `X`) – identisches Muster wie der
  Lösch-Button im Galerie-Editor-Thumbnail-Grid
  (`gallery-editor.tsx`). Ergänzt den bestehenden "Feld entfernen"-Button
  im Eigenschaften-Panel, ersetzt ihn nicht (der bleibt für den Fall, dass
  ein Feld bereits ausgewählt ist).
- Drag-zum-Umsortieren (`onReorderDrop`) und Drag-zum-Verkleinern
  (`onResize`) laufen beide über `draggable`/`onPointerDown` am selben
  Feld-Wrapper – während eines aktiven Zieh-Größenänderns wird
  `draggable` kurzzeitig deaktiviert (`resizingId === null`-Check), damit
  sich beide Gesten nicht gegenseitig auslösen.

## Update 2026-08-23: Formular-Auswahl-Popup beim Einfügen (wie Galerie/FAQ)

Nutzervorgabe: "wenn man formular in den designer zieht, soll sofort ein
popup mit auswahl, welches formular erscheinen, wie bei galerie und faq
auch". Bislang landete der "Formular"-Baustein beim Ziehen auf die
Fläche leer (kein `formId` gesetzt) – die Auswahl musste danach manuell
im Eigenschaften-Popup nachgeholt werden.

- **Neue Erkennung `isFormModuleType()`** (`block-field-output.tsx`,
  gleiches Prinzip wie `isGalleryModuleType`/`isFaqModuleType`): ein
  Modul mit einem Feld vom Typ `"form"` gilt als Formular-Baustein.
- **`handleDropAt()` in `block-editor-field.tsx`** unterscheidet jetzt
  drei Fälle statt zwei: komplexe Module (Galerie/FAQ) → bestehender
  `InsertSharedBlockDialog`, Formular-Module → neuer
  `InsertFormBlockDialog`, alles andere → sofortiges Einfügen wie bisher.
- **`InsertFormBlockDialog`** (neu) ist bewusst NICHT identisch mit
  `InsertSharedBlockDialog`: Formulare sind kein `GlobalModule` und haben
  einen eigenen, vollständigen Editor statt eines Inline-Anlegen-Formulars
  – "Formular erstellen" öffnet `/dashboard/forms/new` in einem neuen Tab
  (`target="_blank"`), damit der aktuelle Seiten-Entwurf nicht verloren
  geht. Nutzt denselben `loadPublishedForms()`-Cache wie der
  Eigenschaften-Popup-Picker (`module-field-input.tsx`, dafür exportiert).
- Die gewählte Form-Id landet über `insertFormAt()` direkt im
  Schema-Feld vom Typ `"form"` (Feldname wird dynamisch aus
  `moduleType.schema.fields` aufgelöst, nicht hartkodiert `"formId"`
  angenommen).

## Update 2026-08-23: Absenden-Button einstellbar + Feldtyp „Datenschutzhinweis"

Nutzervorgabe: "absenden button auch einstellbar machen in rechter
kachel. text ändern, ausrichtung ändern und weiterleitung nach senden
usw." + "datenschutzhinweis block unter erweitert hinzufügen" (mit
Vorgabe-Beispieltext + Verlinkung auf eine Seite per Dropdown).

- **Drei neue `Form`-Spalten** (nicht Teil von `fields`, da formularweit
  statt pro Feld): `submitButtonText` (Default "Absenden"),
  `submitButtonAlign` (`left`/`center`/`right`), `redirectUrl` (optional
  – ersetzt bei erfolgreichem Absenden die eingebaute "Vielen Dank"-
  Meldung durch `window.location.href`-Weiterleitung).
- **Pseudo-Auswahl `SUBMIT_SENTINEL`** in `form-editor.tsx`: der
  Absenden-Button im Aufbau-Canvas ist jetzt klickbar/selektierbar wie
  ein echtes Feld (gleiches Auswahl-Overlay), setzt `selectedId` aber auf
  eine feste Konstante statt einer Feld-Id. Die rechte Kachel rendert je
  nach `selectedId === SUBMIT_SENTINEL` entweder `FieldPropertiesPanel`
  (echtes Feld) oder die neue Geschwister-Komponente
  `SubmitButtonPropertiesPanel` (Text/Ausrichtung/Weiterleitung) – bewusst
  zwei getrennte Komponenten statt eines überladenen Sonderfalls in einer.
- **Neuer Feldtyp `"privacy_notice"`** ("Datenschutzhinweis", Palette-
  Gruppe Erweitert): eine einzelne Einwilligungs-Checkbox, `label` ist der
  Einwilligungstext selbst (Standard: "Ich habe die Datenschutzerklärung
  gelesen und stimme zu.", `required: true` beim Einfügen). Kein
  Options-Array wie bei "checkbox" (Mehrfachauswahl) – konzeptionell ein
  einzelnes Häkchen, kein Auswahl-Set.
  - **Pflichtfeld-Prüfung erweitert:** die generische `isEmpty`-Prüfung in
    `FormsService.submit()` erkennt `undefined`/`null`/`""`/leeres Array,
    aber NICHT `false` – eine nicht angehakte Checkbox hätte die
    Pflichtfeld-Prüfung sonst unbemerkt durchlaufen lassen. Eigener
    zusätzlicher Check: `field.type === 'privacy_notice' && required &&
    value !== true`.
  - **Verlinkung auf eine bestehende Seite** (`privacyPageSlug`/
    `privacyPageTitle`) statt freier URL: Dropdown im Eigenschaften-Panel
    (`PrivacyPagePicker`, neuer `loadPublishedPages()`-Cache analog zu
    `loadPublishedForms()`), lädt veröffentlichte Content-Seiten über
    `GET /api/content?status=PUBLISHED`. Bewusst als Snapshot
    (Slug+Titel) am Feld gespeichert statt einer Content-Id mit
    Live-Auflösung – gleiche Konvention wie `ImageFieldValue`, keine
    zusätzliche Backend-Verknüpfung nötig (Nachteil: Link wird nicht
    automatisch aktualisiert, wenn die Zielseite später umbenannt wird).

## Update 2026-08-23: Echter Feld-Name im Platzhalter-Tooltip

Beim Mailing-Reiter zeigt der Tooltip über einem Platzhalter-Chip nun bei
formulargebundenen Vorlagen (Admin-Benachrichtigung/Bestätigung) den
echten Feld-Namen aus dem Formular-Builder statt eines generischen
Textes ("Wert aus dem Formularfeld „feld_3“") – Nutzervorgabe, der
generische Text sei "blöd".

- **`formFieldLabels(fields)`** (neu, `mail-templates.catalog.ts`):
  Feld-Id → Feld-Label aus `Form.fields`, analog zu
  `formFieldPlaceholders()` (gleicher `section`-Ausschluss).
- **`MailerService.listMailTemplates()`**: formulargebundene Items
  bekommen jetzt zusätzlich `placeholderLabels: Record<string,string>`
  (Feld-Labels + feste Einträge für `formName`/`submittedAt`).
  System-Mail-Items haben `placeholderLabels` nicht gesetzt (`undefined`).
- **Frontend (`mailing-settings-card.tsx`)**: `placeholderDescription()`
  prüft jetzt zuerst `template.placeholderLabels?.[placeholder]`, dann
  die feste `PLACEHOLDER_DESCRIPTIONS`-Tabelle (für die 9 System-Mail-
  Platzhalter wie `link`/`dsrId`/`processorName`), erst danach der
  generische Fallback-Text (der dadurch faktisch nur noch für
  System-Mails mit unbekanntem Platzhalter greift).
- Live gegen ein Testformular mit Datum-/Dropdown-/Radio-/Checkbox-/
  Datenschutzhinweis-Feldern verifiziert: `placeholderLabels` liefert
  korrekt z.B. `feld_2: "Datum"`, `feld_9: "Mehrfachauswahl"`.

## Individuelle HTML-Mail-Vorlagen + E-Mail-Templates (Konzept 2026-08-29, umgesetzt 2026-08-30)

Nutzervorgabe: unter Einstellungen → Mailing soll man komplett individuelle,
frei anlegbare Mail-Vorlagen mit echtem HTML/CSS bauen können, nicht nur
die 8 festen System-Mails/Formular-Mails im aktuellen Plaintext-Format
bearbeiten.

### Korrektur nach der ersten Umsetzung: Tiptap raus, rohes HTML/CSS rein

Die ursprüngliche Planung unten sah vor, denselben Tiptap-Editor wie bei
Seiteninhalten zu nutzen (Begründung damals: kein neuer Code-Editor
nötig, Tiptaps eingeschränktes Schema sei "von Haus aus sicher"). Nach
der ersten Umsetzung harte Nutzerkorrektur: "wenn ich von CI und
Gestaltung spreche, kannst du doch nicht einfach nur einen Texteditor
einsetzen ... ich hatte sogar extra nach einem HTML-Upload gefragt ...
jeder Client hat ein vollständig eigenes Design. da können wir keine
dummen vorgefertigten Bausteine einsetzen." Zu Recht: JEDER Editor mit
eigenem Dokument-Schema – auch ein mächtiger wie Tiptap – kann beliebiges,
von einer Agentur geliefertes Mail-HTML nicht verlustfrei rundreisen,
und vorgefertigte Bausteine sind nur eine andere Art von Einschränkung,
kein "vollständig eigenes Design".

**Tatsächlich umgesetzt:** roher HTML/CSS-Code-Editor
(`html-code-editor.tsx`, CodeMirror + `@codemirror/lang-html`,
`EditorView.lineWrapping` gegen ausbrechende lange Zeilen) statt Tiptap,
für Hülle UND Vorlagen-Inhalt gleichermaßen. Zusätzlich ein "HTML-Datei
hochladen"-Knopf (liest eine lokale `.html`-Datei per `FileReader` direkt
in denselben Editor – das ursprünglich verworfene Datei-Upload-Feature
kam so am Ende doch, nur als Komfortfunktion oben auf dem Code-Editor
statt als Ersatz dafür). Serverseitig läuft das fertige HTML (Hülle +
Inhalt zusammengesetzt) einmal durch `juice`, das jedes `<style>`-
Klassen-CSS in Inline-`style`-Attribute umwandelt, bevor versendet wird –
notwendig, weil rohes Agentur-HTML oft klassenbasiertes CSS mitbringt,
das Outlook & Co. sonst ignorieren würden. Live mit einem echten
`<style>`-Block + Klassen-Design verifiziert: alle Klassen korrekt
inline geschrieben, Inhalt exakt an `{{content}}` eingesetzt.

**Ebenfalls korrigiert:** "E-Mail-Hüllen" heißt in der UI jetzt
"E-Mail-Templates" (Nutzerkorrektur) – nur die Anzeige-Texte, intern
bleibt es das `MailShell`-Modell/`mail-shells`-Route, um keine
Namenskollision mit dem bereits bestehenden `MailTemplate`-Modell
(Inhalte) zu erzeugen.

Der Rest des ursprünglichen Konzepts unten (zwei Bearbeitungsebenen,
mehrere Hüllen pro Installation, `{{content}}`-Platzhalter,
Versand-Reihenfolge) blieb inhaltlich richtig und wurde 1:1 umgesetzt –
nur WIE der HTML/CSS-Code eingegeben wird, hat sich geändert.

### Ursprüngliches Konzept (2026-08-29)

**Ausgangslage (wichtig für die Einordnung):** `MailerService` verschickte
vorher ausschließlich Plaintext (`text:` an nodemailer, nirgends ein
`html:`-Part). `MailTemplate` (siehe oben) war reiner Text mit
`{{platzhalter}}`, bearbeitet über eine Textarea.

**Zwei getrennte Bearbeitungsebenen:**

1. **E-Mail-Hüllen** (`MailShell`, neue Tabelle) – der äußere Rahmen
   (Kopf mit Logo, Fußzeile, CI-Farben). **Mehrere pro Installation**
   (Nutzerkorrektur: nicht nur eine) – z. B. eine schlichte für
   Systemmails, eine auffälligere für individuelle Mailings. Felder:
   `id`, `name`, HTML-Inhalt (Tiptap), `isDefault` (genau eine pro
   Installation). Bearbeitet über denselben Tiptap-Editor wie Vorlagen,
   mit einem speziellen, in Tiptap gesperrten (nicht löschbaren)
   Platzhalter-Baustein, der markiert, wo der eigentliche Vorlagen-Inhalt
   eingesetzt wird. Zusätzliche Server-Validierung beim Speichern: genau
   ein Platzhalter muss vorhanden sein.
2. **Inhalt** (`MailTemplate`, erweitert) – der eigentliche Text/Inhalt
   einer einzelnen Vorlage, weiterhin mit den bestehenden
   Platzhalter-Chips. Neue, frei anlegbare Vorlagen (nicht an einen
   System-`key` oder ein Formular gebunden) über einen neuen
   "+ Neue Vorlage"-Button im Mailing-Bereich. Jede Vorlage bekommt ein
   optionales `shellId` – leer = nutzt die Standard-Hülle der
   Installation.

**Warum das architektonisch einfach reinpasst:** jede Client-Installation
hat schon heute eigene `AppSettings` mit eigenem Logo/eigener
Akzentfarbe/eigener Firmierung (siehe
[master-slave-licensing.md](../platform/master-slave-licensing.md)) –
`MailShell` ist einfach eine weitere, installationseigene Tabelle,
kein neues Beziehungsgeflecht zum Master nötig. "Sein eigenes System mit
eigener CI aufsetzen" bedeutet für einen Client dann: einmalig seine
Hülle(n) bauen, genau wie er heute einmalig Logo/Farbe setzt.

**Versand-Pipeline (Reihenfolge wichtig):**
1. Vorlagen-Inhalt rendern (Platzhalter ersetzen).
2. In die gewählte (oder Standard-)Hülle an der markierten Stelle einsetzen.
3. Am fertigen Gesamt-HTML EINMAL CSS inlinen (z. B. `juice`) – nicht
   getrennt für Hülle und Inhalt, das wäre unnötig komplex und könnte zu
   doppelt inlineten/widersprüchlichen Styles führen.
4. Serverseitig sanitisieren (zweite Sicherheitsschicht zusätzlich zu
   Tiptaps eingeschränktem Schema).
5. Plaintext-Fallback aus dem fertigen HTML ableiten (Tags entfernen),
   Mail als Multipart (`html` + `text`) verschicken.

**Vorschau:** zeigt Inhalt-in-Hülle kombiniert, nicht isoliert – sonst
sieht man nicht, was der Empfänger tatsächlich bekommt.

**Fallback:** eine neue, noch nicht konfigurierte Installation bekommt
eine mitgelieferte, neutrale Standard-Hülle, bis der Client seine eigene
baut – kein Zwang, das sofort beim Setup zu erledigen.

**Bewusst NICHT in der ersten Ausbaustufe:** die 8 festen System-Mails
und Formular-Mails bleiben vorerst Plaintext/ohne Hülle – nur neu
angelegte individuelle Vorlagen bekommen HTML+Hülle. Auslösung
(manueller Versand vs. später programmatisch referenzierbar wie
`sendDataProcessorContractRequest`) ebenfalls offen, Rendering-Funktion
sollte aber von Anfang an beides zulassen.

**Entschieden bei der Umsetzung:** individuelle Vorlagen + E-Mail-
Templates sind (noch) nicht ins Modul-Entitlement-System (siehe
master-slave-licensing.md) einsortiert – laufen ungegatet wie der Rest
von Mailing heute. Bleibt ein offener Punkt für später, falls das
Feature mal Teil eines buchbaren Moduls werden soll.

## Offene Punkte / mögliche Folgearbeiten

- Datei-Upload-Feldtyp (Backend-Katalog vorhanden, kein Upload-Handling).
- Formular-Abschlussrate/Analytics (siehe "Bewusst nicht gebaut").
- Kein Deep-Link von "Bearbeite die Vorlagen unter Einstellungen →
  Mailing" (Formular-Editor, Tab "Benachrichtigung") auf den Mailing-Reiter
  selbst – `settings-form.tsx` hat keine URL-Query-Param-Steuerung für
  `activeSection`, der Link landet auf der allgemeinen Einstellungen-Seite.
- Datenschutzhinweis-Verlinkung (`privacyPageSlug`) ist ein Snapshot,
  keine Live-Verknüpfung – wird die Zielseite umbenannt/verschoben, muss
  die Verlinkung im Formular-Editor manuell neu gesetzt werden.
- Individuelle Mail-Vorlagen/E-Mail-Templates sind ungegatet (kein
  Modul-Entitlement), nur manueller Testversand in der UI (keine
  automatisierte Auslösung, obwohl `sendCustomTemplate()` dafür
  vorbereitet ist).
