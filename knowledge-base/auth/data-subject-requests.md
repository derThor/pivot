# Betroffenenanfragen-Log (Löschanfragen-Neugestaltung)

**Datum:** 2026-08-19
**Betroffene Bereiche:** apps/api (`src/deletion-requests`, `src/mailer`,
`src/privacy`, `src/settings`, `src/roles` [Nachtrag]), apps/web
(`src/components/data-subject-requests-panel.tsx`,
`deletion-request-dialog.tsx`, `deletion-requests-banner.tsx`,
`app/dashboard/system-messages`, `app/dashboard/layout.tsx`,
`lib/permission-labels.ts` [Nachtrag]), `packages/database/prisma/schema.prisma`.

## Was wurde gebaut

Vorheriger einfacher Karten-Tab "Löschanfragen" (Datenschutz-Seite)
komplett durch eine Liste+Detail-Ansicht ersetzt (Nutzervorgabe,
2026-08-19, 1:1 nach Bildvorlage). Trotz beibehaltenem Modell-/Datei-
namen `DeletionRequest` deckt der Tab jetzt **alle drei DSGVO-
Anfragearten** ab (Löschung/Auskunft/Berichtigung), nicht mehr nur
Löschungen.

- **DSR-ID** (`DSR-2026-014`), pro Kalenderjahr fortlaufend, beim
  Anlegen einmalig berechnet und als String gespeichert (bleibt stabil,
  auch wenn ältere Einträge später verschwinden).
- **Neue Felder**: `type` (Löschung/Auskunft/Berichtigung), `source`
  (Quelle, freier Text – kein Formular-Modul mit fester Liste),
  `affectedRecordsCount` (Betroffene Datensätze, manuell erfasst),
  `linkedUserId` (siehe unten), `reminderSentAt`.
- **Frist-Default**: 1 Monat ab Eingang (Art. 12(3) DSGVO), wenn beim
  Anlegen keine eigene Frist gesetzt wird.
- **Requester-Feld**: Person per Select aus bestehenden Konten wählbar
  ODER frei eintragen (Nutzervorgabe aus einer früheren Session-Runde:
  "muss ein Nutzer auch auswählbar sein, aber auch selber was
  eintragen können") – die Auswahl übernimmt Name/E-Mail nur als
  Vorbelegung, beide Felder bleiben frei editierbar.
- **Drei Detail-Aktionen** – bewusst reine Protokoll-/Attestierungs-
  Funktionen, keine Live-Datenlöschung/-abfrage, da es keine feste
  Verknüpfung zu konkreten Datensätzen gibt (kein Formular-Modul,
  Quelle ist freier Text):
  - **"Datenauszug erstellen"** (Nutzer-Antwort auf Rückfrage: "Wenn
    ein echtes Konto vorhanden ist, dann verknüpfen, ansonsten nur die
    Anfrage"): sucht per E-Mail-Abgleich (`requesterEmail` gegen
    `User.email`, anonymisierte Konten ausgeschlossen) ein
    bestehendes Konto. Bei Treffer wird `linkedUserId` dauerhaft
    gesetzt und der **echte** Art.-15-Bericht erzeugt (derselbe
    Generator wie beim "Auskunft erstellen"-Button auf der
    Betroffenenrechte-Karte, siehe
    [privacy-page.md](./privacy-page.md)). Ohne Treffer nur ein
    Nachweis-Protokoll der Anfrage selbst (DSR-ID/Art/Eingang/Frist/
    Quelle/Status als CSV).
  - **"Daten endgültig löschen"**: reine Attestierung per
    Bestätigungsdialog ("Wurde die Löschung außerhalb des Systems
    erledigt?") – markiert die Anfrage als erledigt + Audit-Log-
    Eintrag. Kein echter Datenzugriff.
  - **"Rückfrage an Absender"**: öffnet ein Popup mit einem
    Freitext-Feld (Nutzer-Nachtrag: "ich möchte ... ein Popup, wo ich
    meine Rückfrage selber stellen kann" – ursprünglich als
    Ein-Klick-Festtext geplant, dann korrigiert), verschickt die vom
    Admin selbst formulierte Nachricht als Mail an den Absender.
- **"Automatik"-Karte** (globale `AppSettings`, nicht pro Anfrage):
  - "Eingang automatisch bestätigen" – Mail an den Absender direkt
    beim Anlegen einer neuen Anfrage.
  - "Erinnerung 7 Tage vor Fristende" – täglicher Cron
    (`DeletionRequestReminderSchedulerService`, Muster:
    `PrivacyReportSchedulerService`), Mail an den DSB
    (`AppSettings.dpoEmail`), nicht an den Absender – `reminderSentAt`
    verhindert doppelten Versand.
- **Systembenachrichtigungen-Integration** (Nutzer-Nachtrag:
  "Löschanfragen unter Systembenachrichtigungen aufführen", direkt im
  Anschluss an die grundsätzliche Standing Rule aus derselben Session,
  siehe [toast-and-system-messages.md](../frontend/toast-and-system-messages.md)):
  neue Kategorie `notifyDeletionRequests`, Banner auf
  `/dashboard/system-messages` mit Link zurück
  (`/dashboard/privacy?tab=loeschanfragen` – dafür `?tab=`-Deep-Link-
  Unterstützung in `privacy-view.tsx` ergänzt, Muster:
  `my-account-view.tsx`), zählt in den Glocken-Badge im Header mit.
- **Nachtrag, gleiche Session: "Privacy" hieß bei Rollen & Rechte noch
  roh "privacy"** statt "Datenschutz" – `lib/permission-labels.ts`
  hatte für die Ressource `privacy` schlicht keinen Eintrag in
  `resourceLabels`/`resourceIcons` (fiel auf den rohen Backend-
  Ressourcennamen zurück). Ergänzt: `privacy: "Datenschutz"` +
  `Lock`-Icon (dasselbe Icon wie der Datenschutz-Sidebar-Eintrag).

## Warum diese Lösung

- **Attestierung statt Live-Löschung**: Es gibt in dieser App kein
  Formular-Modul und keine feste Verknüpfung zwischen einer Anfrage
  und konkreten Systemdatensätzen (die "Betroffene Datensätze"-Zahl
  ist eine manuelle Eingabe). Eine "echte" automatische Löschung
  vorzugaukeln wäre eine irreführende Attrappe gewesen (siehe
  PROCESS.md-Prinzip, bereits mehrfach in dieser Session angewendet,
  z.B. bei der Betroffenenrechte-Karte). Stattdessen: ehrliche
  Protokollierung, die die Rechenschaftspflicht (Art. 5(2) DSGVO)
  erfüllt – siehe Diskussion direkt vor dieser Umsetzung: "wollen wir
  Löschanfragen protokollieren und exportieren? macht das sinn, die
  zu behalten, auch wenn der nutzer gelöscht wurde?" → ja,
  Rechenschaftspflicht, Datensatz übersteht Nutzerlöschung bereits von
  selbst (Name/E-Mail sind freier Text, `linkedUserId` ist nullable
  mit `onDelete: SetNull`).
- **DSR-ID als gespeicherter String statt berechneter Wert**: garantiert
  Stabilität – eine on-the-fly-Berechnung (z.B. "Zeilen-Rang des
  Jahres") würde sich verschieben, sobald ein älterer Eintrag entfernt
  wird.
- **Automatik-Karte mit eigener, kompakterer Zeilen-Komponente
  (`CompactSwitchRow`) statt der global genutzten `SwitchRow`**: die
  globale `SwitchRow`/`Label` nutzt `text-base` (16px), was in dieser
  schmalen 360px-Seitenspalte zu groß wirkte und der Label-Text auf
  zwei Zeilen umbrach (Nutzer-Bugreport per Screenshot). Größe auf
  `text-sm` reduziert, an die übrige Kartendichte dieses Panels
  angeglichen – bewusst **nicht** die globale `SwitchRow` verkleinert,
  das hätte Einstellungen/DSB-Tab ungefragt mitverändert.

## Nachtrag 2026-08-19: Selbstauskunft/-löschung – Backend fertig, Frontend folgt später

Ursprünglich als "später"-Vorhaben zurückgestellt (siehe Zitat unten),
noch am selben Tag doch als Backend umgesetzt (Nutzervorgabe: "bau die
selbstauskunft aus dem eigenen kontop backend. frontend folgt später").

- **`POST /deletion-requests/self-service`**
  (`DeletionRequestsService.createSelfService()`) – bewusst **kein**
  `@RequirePermission` am Controller-Handler: das ist keine Admin-
  Funktion, jeder eingeloggte Nutzer darf eine Anfrage zu sich selbst
  stellen. Der global registrierte `JwtAuthGuard`
  (`auth.module.ts`, `APP_GUARD`) verlangt trotzdem einen gültigen
  Login – `PermissionsGuard` lässt Routen ohne `@RequirePermission`-
  Metadaten grundsätzlich durch (`canActivate()` gibt `true` zurück,
  wenn `requiredPermission` fehlt), das ist kein Sicherheitsloch,
  sondern genau das etablierte Muster für Selbstbedienungs-Routen
  (siehe `auth.controller.ts`: `PATCH /auth/me`, `PATCH /auth/password`
  usw. – ebenfalls ohne `@RequirePermission`).
- **`CreateSelfServiceRequestDto`** nimmt bewusst **kein**
  `requesterName`/`requesterEmail` entgegen – die kommen aus dem
  eigenen Konto des Aufrufers (`@CurrentUser()` → `user.sub` →
  `prisma.user.findUniqueOrThrow()`), nicht aus dem Request-Body.
  Verhindert, dass jemand im Namen einer anderen Person eine Anfrage
  anlegt. `linkedUserId` wird **sofort** beim Anlegen gesetzt (nicht
  erst nachträglich per E-Mail-Abgleich wie beim Admin-Flow über
  "Datenauszug erstellen") – `source` fest auf "Selbstauskunft (Mein
  Konto)", damit sich Selbstbedienungs- von Admin-angelegten Anfragen
  im Log unterscheiden lassen. Gemeinsame Logik mit dem Admin-`create()`
  (Eingangsbestätigung-Mail, falls `dsrAutoAcknowledgeReceipt` aktiv)
  in `sendAcknowledgementIfEnabled()` extrahiert, damit beide Pfade
  nicht auseinanderlaufen.
- Per curl End-to-End verifiziert: Aufruf mit einem normalen
  Nutzer-Token legt eine Anfrage mit korrekt vorbefülltem Namen/E-Mail
  und gesetztem `linkedUserId` an; "Datenauszug erstellen" liefert für
  diesen Eintrag direkt den **echten** Art.-15-Bericht (3-spaltiges
  `Bereich/Feld/Wert`-Format), nicht das Nachweis-Protokoll – die
  sofortige Verknüpfung greift also tatsächlich, kein nachträglicher
  Abgleich nötig.
- **Frontend bewusst nicht gebaut** (Nutzervorgabe: "frontend folgt
  später") – noch kein Button/Formular auf `/dashboard/account`, das
  diesen Endpoint aufruft. Wer als Nächstes daran arbeitet: Endpoint
  ist fertig und getestet, es fehlt nur die UI dafür.

**Ursprüngliches Zitat (2026-08-19, vor diesem Nachtrag)**: "Man soll
das später aus seinem Account im Frontend heraus machen können. Da
wäre dann ein Benutzerkonto verknüpft." – der zweite Teil (Formular im
Footer) bleibt weiterhin zurückgestellt, siehe unten.

## Nachtrag 2026-08-19: Eigene Anfragen sichtbar + Info-Popup

Direkt im Anschluss an die "Meine Daten"-Karte (Nutzervorgabe: "wenn
ich eine anfrage anklicke, will ich ein popup mit allen infos zur
anfrage") – bis dahin gab es nur den "Anfrage stellen"-Button, keine
Möglichkeit, bereits gestellte eigene Anfragen zu sehen.

- **`GET /deletion-requests/self-service`** (`DeletionRequestsService
  .findMineForUser()`) – ebenfalls ohne `@RequirePermission`, liefert
  nur Anfragen mit `linkedUserId === user.sub`. Admin-seitig ohne
  Verknüpfung angelegte Anfragen (z.B. externe Anfragen per Post)
  erscheinen hier bewusst nicht.
- `self-service-request-card.tsx`: Liste der eigenen Anfragen (Art,
  DSR-ID, Datum, Status-Badge amber/grün) oberhalb des "Anfrage
  stellen"-Buttons, per Klick öffnet ein **reines Info-Popup**
  (DSR-ID/Art/Status/Eingang/Frist/Grund/Erledigt am) – anders als das
  Admin-Detail-Panel bewusst **ohne** Aktions-Buttons ("Datenauszug
  erstellen"/"Daten endgültig löschen"/"Rückfrage an Absender" sind
  Admin-Funktionen, kein Selbstbedienungs-Feature).
- `app/dashboard/account/page.tsx` lädt die Liste serverseitig
  (`getMyDeletionRequests()`) parallel zu Sessions/Stats, gleiches
  Muster wie die übrigen Account-Daten.
- Per Playwright verifiziert: neue Anfrage erscheint sofort in der
  Liste (kein Reload nötig, lokaler State-Update wie beim Admin-Panel),
  Klick zeigt alle Felder korrekt im Popup.
- **Zwei Nachträge, selbiger Tag**: Karte auf Nutzerwunsch vom
  Sicherheit- in den Profil-Tab verschoben (rechte Spalte, neben
  "Meine Rolle"/"Diese Woche"). Und der Popup-Trigger wurde vom
  gesamten Zeilen-Klick auf ein dediziertes `Info`-Icon je Zeile
  umgestellt (Nutzervorgabe: "beim klick auf ein icon je anfrage alle
  informationen dazu geben, auch den kommentar") – "Grund" (der
  Kommentar) war bereits Teil des Popups, nur der Trigger hat sich
  geändert.

## Nachtrag 2026-08-20: Glocken-Badge aktualisierte sich nach DSR-Aktionen nicht

Nutzer-Bugreport: "die anzahl in der glocke im header aktualisiert
sich nicht zuverlässig. anfragen usw." – `dashboard/layout.tsx` (Bell-
Badge) ist ein Server Component, das bei reiner Client-Navigation
zwischen `/dashboard/*`-Routen **nicht neu rendert**, außer
`router.refresh()` wird explizit aufgerufen (gleiche Grundursache wie
der frühere Bugreport in
[toast-and-system-messages.md](../frontend/toast-and-system-messages.md)
zum Badge-Zähler selbst, hier aber die Ursache dafür, dass er nach
Aktionen stehenbleibt statt falsch zu zählen). `trash-view.tsx` hatte
das von Anfang an korrekt (jeder Handler ruft `router.refresh()`) –
beim Bauen der beiden DSR-Komponenten wurde das schlicht vergessen:

- `data-subject-requests-panel.tsx`: `router.refresh()` fehlte nach
  Anlegen/Erledigt-Markieren (`upsert()`) und nach Löschen
  (`handleDelete()`) – beide ergänzt.
- `self-service-request-card.tsx`: hatte **gar keinen** `useRouter()`-
  Import, entsprechend nirgends einen Refresh – nach Anlegen
  (`handleSubmit`) und Zurückziehen (`handleWithdraw`) ergänzt.
- Per Playwright verifiziert (mit echtem Klick auf die Glocke statt
  `page.goto()`, das den Bug maskiert hätte, da es immer einen
  Full-Page-Request auslöst): Banner-Text auf
  `/dashboard/system-messages` zeigt die aktualisierte Zahl direkt nach
  dem Anlegen, ohne manuellen Reload.

## Nachtrag 2026-08-19: Admin-Liste bekommt dasselbe Icon-Popup + Löschen, Selbstbedienung bekommt "Zurückziehen"

Direkt im Anschluss an das Info-Popup in "Meine Daten" fragte der
Nutzer per Screenshot nach, wo das eigentlich liege (Admin- vs.
Selbstbedienungs-Ansicht sind zwei getrennte Orte) – Klärung führte zu
einer bewussten Entscheidung: **beide** Listen bekommen das gleiche
Icon-Popup-Muster, aber mit unterschiedlichem Funktionsumfang.

- **Admin-Liste** (`data-subject-requests-panel.tsx`): Zeile ist nicht
  mehr ein einzelnes `<button>` (verschachtelte interaktive Elemente
  wären ungültiges HTML), sondern ein `<div>` mit einem `<button>` fürs
  Auswählen (Avatar+Name+E-Mail) und zwei separaten Icon-`<button>`s
  daneben: `Info` (öffnet dasselbe reine Info-Popup wie bei "Meine
  Daten", zusätzlich zum bereits bestehenden rechten Detail-Panel) und
  neu `Trash2` ("Anfrage löschen", Nutzervorgabe: "anfragen muss man
  löschen können" – ruft den bereits bestehenden, aber bisher nicht
  verdrahteten `DELETE /deletion-requests/:id`-Endpoint auf, hinter
  `ConfirmDeleteDialog`).
- **Selbstbedienung** (`self-service-request-card.tsx`): gleiche
  Umstellung von Zeilen-Klick auf Info-Icon (aus demselben Grund:
  verschachtelte Buttons). Popup bekommt zusätzlich **"Anfrage
  zurückziehen"** (Nutzervorgabe, per Screenshot direkt im Popup
  gezeigt) – neuer Endpoint `DELETE /deletion-requests/self-service/:id`
  (`DeletionRequestsService.withdrawSelfService()`), der die
  Ownership prüft (`linkedUserId === user.sub`, sonst
  `ForbiddenException`) und dann denselben `remove()`-Mechanismus wie
  der Admin-Delete nutzt. Button nur sichtbar, wenn Status nicht
  bereits `completed`/`rejected` ist.
- Neue BFF-Routen: `app/api/deletion-requests/self-service/[id]/route.ts`
  (DELETE, neben dem bestehenden `self-service/route.ts` für GET/POST –
  Next.js unterscheidet die Pfade automatisch).

## Nachtrag 2026-08-19: "Papierkorb läuft ab" in Systembenachrichtigungen

Gleiches Muster wie die Firma-/Rechtstexte-/Betroffenenanfragen-
Kategorien zuvor (Standing Rule, siehe
[toast-and-system-messages.md](../frontend/toast-and-system-messages.md)):
neue Kategorie `notifyTrashExpiring`, Banner `trash-expiring-banner.tsx`
spiegelt den bereits bestehenden Inline-Warnhinweis auf der Papierkorb-
Seite selbst (`trash-view.tsx`, "8 Einträge verfallen in den nächsten 7
Tagen"). Gate: mindestens eine der sechs Papierkorb-`:read`-
Berechtigungen (`content`/`media`/`categories`/`tags`/`gallery`/`faq`),
deckt sich mit `TrashController.readableTypes()`.

## Nachtrag 2026-08-19: Adressfelder (Straße/PLZ/Ort) für alle Datenschutzauskünfte

Nutzervorgabe: "bei mein profil und benutzer detail strasse, plz ort
mit aufnehmen. berücksichtige das bei allem datenschutzauskünften
usw." – `User.street`/`postalCode`/`city` (alle optional) ergänzt und
konsequent überall durchgezogen, wo Nutzerdaten bearbeitet oder
exportiert werden:

- `UpdateProfileDto`/`UpdateUserDto`/`CreateUserDto` (Backend),
  `publicSelect` in `users.service.ts` (sonst würden die Felder
  gar nicht erst zurückgegeben)
- `account-form.tsx` (Mein Konto → Profil) und `user-edit-view.tsx`
  (Admin → Benutzer bearbeiten) – zwei **getrennte**, dupliziert
  gepflegte Formulare (kein gemeinsames Component), beide einzeln
  erweitert
- `PrivacyService.generateSubjectAccessReportCsv()` – die "Auskunft
  erstellen"/Selbstauskunft-CSV bekommt drei neue Konto-Zeilen
  (Straße/PLZ/Ort)
- `export-profile-button.tsx` ("Daten exportieren" in Mein Konto,
  eigener einfacher JSON-Export) ebenfalls ergänzt
- **Bewusst nicht angefasst**: `create-user-dialog.tsx` (Einladen-
  Flow) – `UsersService.create()` vergibt Abteilung/Telefon schon
  heute nicht bei der Erstellung (nur bei einem späteren Bearbeiten),
  dieselbe bestehende Lücke gilt jetzt konsistent auch für die
  Adressfelder, kein neu eingeführtes Verhalten.

## Nachtrag 2026-08-19: Frontend doch direkt mitgebaut – Begriffsklärung "Frontend"

Kurz nach dem Backend-only-Nachtrag oben stellte sich heraus, dass
"Frontend folgt später" missverständlich war: Nutzer-Klarstellung
("doch button einbauen für Anfrage im Konto. ich unterscheide backend
und frontend. frontend ist die webseite für den endanwender und nicht
die oberfläche des backends") – mit "Frontend" meinte der Nutzer eine
künftige **öffentliche Website**, nicht das Dashboard (`apps/web`
selbst gilt in seiner Terminologie als "Backend-Oberfläche", auch wenn
es technisch ein Next.js-Frontend ist). Das Dashboard-UI dafür wurde
daraufhin doch direkt gebaut:

- **Neue Komponente `self-service-request-card.tsx`** ("Meine Daten",
  Mein Konto → Sicherheit-Tab, neben "Meine Sitzungen"): Karte mit
  Kurzerklärung + Button "Anfrage stellen", öffnet einen Dialog
  (Art-Auswahl Löschung/Auskunft/Berichtigung + optionale Anmerkung),
  ruft `POST /deletion-requests/self-service` auf. Fragt bewusst
  **keine** Kontaktdaten ab – die kommen serverseitig aus dem
  eingeloggten Konto.
- **Neue BFF-Route** `app/api/deletion-requests/self-service/route.ts`
  (statischer Pfad neben dem bestehenden `[id]`-Segment – Next.js
  bevorzugt statische Segmente automatisch, gleiches Muster wie
  `data-processors/contracts.zip` neben `data-processors/[id]`).
- Per Playwright End-to-End verifiziert: Dialog öffnet, Absenden
  erzeugt eine echte Anfrage mit korrekter DSR-ID, Toast bestätigt.

**Zusätzlich im selben Zug: Pagination für "Meine Sitzungen"**
(Nutzervorgabe: "pagination in mein konto Meine Sitzungen") –
`my-account-view.tsx` lud bisher *alle* aktiven Sitzungen ungepaginiert
(im Unterschied zur Admin-Seite `user-edit-view.tsx`, die dafür längst
`PaginationControls` im Client-Modus nutzt, siehe deren Code-Kommentar:
"z.B. 'Aktive Sitzungen' im Benutzer-Bearbeiten-Tab, wo eine eigene
URL-Seite nicht passt"). Exakt dasselbe Muster jetzt auch in
`my-account-view.tsx` übernommen (`SESSIONS_PAGE_SIZE = 5`,
`sessionsPage`/`visibleSessions`-State, `onPageChange`-Modus statt
URL-`?page=`, da die Seite bereits einen eigenen `?tab=`-Parameter
nutzt). Der Testlauf dafür brachte einen echten Nebenbefund zutage:
das Test-Konto `layout-check@example.com` hatte durch die vielen
Login-Aufrufe im Laufe dieser Session **37 Seiten** (≈185) aktiver
Sitzungen angesammelt – ein greifbarer Beleg, warum die Pagination
gebraucht wird, nicht nur vorsorglich war. Nach dem Test über "Alle
anderen Sitzungen beenden" aufgeräumt.

## Bewusst weiterhin nicht gebaut

- **Formular im Footer einer echten öffentlichen Website**: Nutzer-
  Zitat: "Außerdem soll es ein Formular im Footer allgemein geben." –
  bleibt zurückgestellt; es gibt in diesem Repo keine öffentliche
  Website-Auslieferung (`apps/web` ist reines Headless-CMS-Dashboard),
  ein öffentliches Formular bräuchte entweder ein separates Formular-
  Modul oder eine externe, das API konsumierende Website.

## Relevante Dateien

- `packages/database/prisma/schema.prisma` (`DeletionRequest`-
  Erweiterung, `User.linkedDeletionRequests`, `AppSettings.dsr*`/
  `notifyDeletionRequests`)
- `apps/api/src/deletion-requests/*` (Service/Controller/DTOs/
  `deletion-request-reminder-scheduler.service.ts`, neu; darunter
  `dto/create-self-service-request.dto.ts` und
  `dto/send-follow-up.dto.ts`, beide neu)
- `apps/api/src/mailer/mailer.service.ts` (3 neue Dev-Stub-Methoden)
- `apps/api/src/privacy/privacy.module.ts` (`PrivacyService` exportiert,
  von `DeletionRequestsService` für den Datenauszug wiederverwendet)
- `apps/api/src/settings/*`, `apps/api/src/roles/permissions.catalog.ts`
  (unverändert, nur Frontend-Label-Nachtrag)
- `apps/web/src/components/data-subject-requests-panel.tsx` (neu, groß),
  `deletion-request-dialog.tsx` (erweitert), `deletion-requests-banner.tsx`
  (neu)
- `apps/web/src/components/privacy-view.tsx` (`?tab=`-Deep-Link,
  Tab-Label "Löschanfragen" → "Anfragen")
- `apps/web/src/app/dashboard/system-messages/page.tsx`,
  `app/dashboard/layout.tsx` (neue Kategorie, Bell-Badge)
- `apps/web/src/lib/permission-labels.ts` (Nachtrag: `privacy`-Label/-Icon)
- `apps/web/src/components/self-service-request-card.tsx` (neu),
  `my-account-view.tsx` (Sitzungen-Pagination + Karte eingebunden)
- `apps/web/src/app/api/deletion-requests/self-service/route.ts` (neu,
  GET + POST)
- `apps/web/src/app/dashboard/account/page.tsx` (`getMyDeletionRequests()`)
- `apps/web/src/app/api/deletion-requests/[id]/{data-extract,complete,follow-up}/route.ts`
  (neu)

## Update 2026-09-02: Anfragen von der öffentlichen Website

Zweiter Eingangskanal neben „Mein Konto": ein Selbstauskunft-Link unter
jedem Formular auf der Website. Details, Abwägungen und die Tabelle der
Einzelentscheidungen stehen in
[forms.md](../content/forms.md#update-2026-09-02-5-selbstauskunft-im-formular-footer).

Für dieses Dokument die drei relevanten Punkte:

- **`POST /deletion-requests/public`** ist `@Public()` – ein
  Website-Besucher hat kein Konto, und ein Betroffenenrecht darf nicht
  davon abhängen, ob man hier Kunde ist. Deshalb eng gedrosselt
  (`@Throttle` 3/Minute).
- **`createFromPublicForm()` gibt keine Daten heraus** und verrät auch
  nicht, ob zu der Adresse etwas vorliegt. Die Identitätsprüfung passiert
  unverändert beim Bearbeiten der Anfrage.
- **`linkedUserId` bleibt leer.** Die Verknüpfung mit einem Konto entsteht
  erst über den geprüften E-Mail-Abgleich beim „Datenauszug erstellen" –
  anders als bei `createSelfService()`, wo der Login die Identität schon
  belegt hat.

Die Bestätigungsmail (`dsrAutoAcknowledgeReceipt`) verhält sich wie bei
jeder anderen Anfrage; die Anfragen sind an `source: "Selbstauskunft
(Formular)"` erkennbar.
