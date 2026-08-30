# Benutzer-Aktivität: echte, paginierte Zeitleiste im "Aktivität"-Tab

**Datum:** 2026-08-17
**Betroffene Bereiche:** apps/api (`src/audit-log`, `src/users`, `src/auth`,
`src/media`, `src/content`), apps/web (`src/components/user-activity-timeline.tsx`,
`src/components/user-edit-view.tsx`, `src/app/api/users/[id]/activity`)

## Was wurde gebaut

Der "Aktivität"-Tab auf der Benutzer-Profilseite (`/dashboard/users/[id]/edit`,
siehe `docs/ROADMAP.md` 2b.14) war bisher ein reiner "in Vorbereitung"-Platzhalter.
Ersetzt durch eine echte, serverseitig paginierte Zeitleiste ("Verlauf"), 1:1
nach Bildvorlage aufgebaut (Punkt+Linie-Timeline, Titel + Kategorie/Akteur ·
Datum · Uhrzeit).

- **`AuditLogService`** (neu, `apps/api/src/audit-log/`, `@Global()`-Modul
  wie `CacheService`): zentraler Schreib-/Lesezugriff auf das bereits
  bestehende, aber kaum genutzte `AuditLog`-Prisma-Modell (bisher nur für
  `user.impersonate` beschrieben). `.record()` schreibt einen Eintrag,
  `.findForUser(userId, page, pageSize)` liefert die Zeitleiste eines
  Nutzers: alles, was er selbst getan hat (`userId = X`) ODER was ein
  anderer an seinem Konto verändert hat (`entityType: "User", entityId: X`),
  z.B. eine Rollenänderung durch einen Administrator.
- **Echte serverseitige Pagination**: `skip`/`take` in der Prisma-Query,
  nicht "alles laden und im Speicher blättern" – neuer Index
  `@@index([userId, createdAt])` auf `AuditLog` (zusätzlich zum
  bestehenden `@@index([entityType, entityId])`) hält das auch bei vielen
  Einträgen schnell. Frontend nutzt `PaginationControls` im bestehenden
  `onPageChange`-Modus (Client-seitig nachgeladen über eine neue BFF-Route
  `GET /api/users/:id/activity`), nicht den `buildHref`-URL-Modus – gleiches
  Muster wie die "Aktive Sitzungen"-Liste im selben Bearbeiten-Formular.
- **`GET /users/:id/activity`** (`users.controller.ts`, Berechtigung
  `users:read`, `QueryActivityDto` mit `page`/`pageSize`, Default
  `pageSize: 10`, Max `50`).
- **Erfasste Ereignisse** (jeweils ein `auditLog.record()`-Aufruf an der
  Stelle, wo die Aktion tatsächlich passiert):
  - `user.created` – `UsersService.create()` (Admin legt an, `metadata:
    {method:"admin_created"}`) und `AuthService.register()`
    (Selbstregistrierung, `metadata:{method:"self_registered"}`)
  - `user.role_changed` – `UsersService.update()`, nur wenn sich die
    Rollen-IDs tatsächlich ändern (Set-Vergleich gegen die bestehenden
    `UserRole`-Zeilen, nicht bei jedem Speichern mit unveränderten Rollen),
    `metadata:{roleNames:string[]}`
  - `user.password_changed` – `AuthService.changePassword()` (Self-Service)
    und `AuthService.resetPassword()` (Reset-Link-Flow)
  - `user.2fa_enabled` – `AuthService.verifyTwoFactorSetup()`
  - `user.2fa_disabled` – `AuthService.disableTwoFactor()` (Self-Service)
    und `UsersService.disableTwoFactor()` (Admin-Notausgang, Signatur um
    `actingUserId` erweitert, damit der richtige Akteur geloggt wird)
  - `user.impersonate` – Bestandsfeature (`AuthService.impersonate()`),
    war schon vorher der einzige echte `AuditLog`-Schreibzugriff im
    Projekt, jetzt zusätzlich in der Zeitleiste sichtbar (deutscher Titel
    "Sitzung durch Administrator übernommen")
  - `media.uploaded` – `MediaService.create()` (gilt für jeden Upload,
    auch Profilbilder/Firmenlogo über denselben Mechanismus – bewusst
    nicht herausgefiltert, es ist ein echtes Ereignis)
  - `content.published` – `ContentService.create()`/`update()`, jeweils
    nur beim tatsächlichen Übergang zu `PUBLISHED` (dieselbe Stelle, an der
    auch der `content.published`-Webhook ausgelöst wird)
- **Frontend-Formatierung** (`user-activity-timeline.tsx`,
  `describeActivity()`): übersetzt `action`+`metadata` in deutschen
  Titel + Kategorie-/Akteur-Zeile. Bewusst im Frontend statt im Backend
  formatiert (gleiches Prinzip wie die Toast-Texte in `app-toast.tsx`) –
  die strukturierten `action`/`metadata`-Felder bleiben technisch/englisch,
  die UI-Sprache lebt an einer Stelle im Frontend.

## Bewusst abweichend von der Bildvorlage (kein erfundener Wert)

- **Kein "Formular veröffentlicht"-Eintrag**: es gibt kein Formular-Modul
  in dieser App (siehe bereits bestehender Kommentar an
  `UsersService.getStats()`, gleiche Begründung wie beim Weglassen von
  "Formulare" in der Sidebar-Kennzahlen-Karte).
- **"Einladung angenommen" ersetzt durch den echten Erstellungsweg**: die
  Bildvorlage suggeriert einen Invite-Accept-Flow, den es hier nicht gibt
  (Admin-angelegte Nutzer bekommen stattdessen einen Passwort-Reset-Link,
  siehe `rbac-rework.md`). Zeile zeigt stattdessen ehrlich "Angelegt von
  {Admin}" bzw. "Selbst registriert".
- **Keine Medien-Sammelzahl** ("12 Medien hochgeladen"): jeder Upload
  erscheint als eigener, echter Zeitleisten-Eintrag mit Dateinamen, statt
  eine Gruppierungs-/Aggregationslogik zu erfinden, die es so nicht gibt.
  **Vom Nutzer bestätigt (2026-08-17): passt so, keine Tages-Gruppierung
  gewünscht.**

## Laufende Konvention (Nutzervorgabe 2026-08-17)

Jede künftige nutzerbezogene Aktion bekommt beim Bauen sowohl einen
`AuditLogService.record()`-Aufruf an der Stelle, wo sie passiert, als auch
einen passenden Fall in `describeActivity()` im Frontend – siehe
`docs/ROADMAP.md`, Nachtrag zu 2b.14. Die Zeitleiste soll nicht
stillschweigend hinter neuen Features zurückbleiben.

## Relevante Dateien

- `packages/database/prisma/schema.prisma` (`AuditLog` – neuer Index)
- `apps/api/src/audit-log/{audit-log.module,audit-log.service}.ts` (neu)
- `apps/api/src/users/dto/query-activity.dto.ts` (neu),
  `users.service.ts` (`create`, `update`, `disableTwoFactor`, `getActivity`),
  `users.controller.ts` (`GET :id/activity`, `disableTwoFactor` um
  `actingUser` erweitert)
- `apps/api/src/auth/auth.service.ts` (`register`, `changePassword`,
  `resetPassword`, `verifyTwoFactorSetup`, `disableTwoFactor`)
- `apps/api/src/media/media.service.ts` (`create`)
- `apps/api/src/content/content.service.ts` (`create`, `update`)
- `apps/web/src/lib/api-server.ts` (`ActivityLogEntry`,
  `ActivityLogResponse`, `getUserActivity()`)
- `apps/web/src/components/user-activity-timeline.tsx` (neu),
  `user-edit-view.tsx` (Tab "Aktivität")
- `apps/web/src/app/api/users/[id]/activity/route.ts` (neu, BFF)
- `apps/web/src/app/dashboard/users/[id]/edit/page.tsx`

## Offene Punkte

- Kein e2e-Test für `GET /users/:id/activity` (nur manuell gegen die
  laufenden Dev-Server verifiziert).

## Browser-Verifikation (2026-08-17)

Per Playwright end-to-end getestet: Testnutzer über den echten
"Benutzer einladen"-Dialog angelegt (→ `user.created`), Medium über den
echten Upload-Dialog hochgeladen (→ `media.uploaded`), Rolle des
Testnutzers als Administrator geändert (→ `user.role_changed`). Beide
betroffenen Zeitleisten geprüft:
- Der **Zielnutzer** sieht "Konto erstellt · Angelegt von {Admin}" und
  "Rolle geändert zu {Rollen} · von {Admin}".
- Der **Admin selbst** sieht dieselben zwei Einträge ebenfalls in seiner
  eigenen Zeitleiste (er war der Akteur) – korrektes, beabsichtigtes
  Verhalten der OR-Bedingung in `findForUser()`, kein Duplikat-Bug.

Punkt-Farben (aktuellstes Ereignis lime, ältere grau), Verbindungslinie
(`bg-neutral-300`) und der Abstand unter "Rolle" wurden im selben
Durchlauf visuell mitgeprüft. Alle Testdaten (Testnutzer, Testmedium,
zugehörige `audit_logs`-Zeilen) danach wieder entfernt.

## Nachtrag 2026-08-30: fehlende Aktionen zeigten den rohen Action-Code

Nutzer-Bugreport: mehrere Einträge zeigten `settings.field_updated`
unübersetzt statt eines deutschen Titels – `describeActivity()`s
`switch` deckte nur die Aktionen ab, die beim ursprünglichen Bau
(2b.14) existierten, jede seither neu hinzugekommene Audit-Log-Aktion
fiel auf den `default`-Zweig (roher `entry.action`) zurück. Bei
"alle korrigieren" wurde der komplette Aktions-Katalog gegengeprüft
(`grep -rn "action: '" apps/api/src`), nicht nur der eine gemeldete
Fall.

**Ergänzt:** `deletion_request.completed`, `privacy_incident.reported`,
`privacy_incident.subjects_notified`, `auth.all_sessions_revoked`,
`auth.password_reset_forced_all`, und ein genereller Fallback für jede
`settings.*`-Aktion (`field_updated`, `smtp_updated`,
`license_api_key_updated`, `job_runs_deleted`).

**Strukturell wichtig:** das Feld-Label-Wörterbuch für
`settings.field_updated` existierte bereits – aber nur lokal in
`settings-protocol-card.tsx` (Einstellungen → Protokoll), das dieselben
Aktionen schon länger korrekt übersetzte. Jetzt ausgelagert nach
`apps/web/src/lib/settings-change-labels.ts`
(`SETTINGS_FIELD_LABELS`/`describeSettingsFieldChange`/
`describeSettingsAction`), von beiden Stellen importiert – vermeidet,
dass ein neues Einstellungsfeld nur an einer der beiden Stellen ein
Label bekommt und an der anderen wieder roh auftaucht. Auch
`licenseApiKey` (Einstellungen → Master-Client, API-Key ändern) fehlte
im Wörterbuch und wurde ergänzt.

**Lehre:** bei einem gemeldeten "roher Code statt Text"-Bug immer den
ganzen Katalog gegenprüfen (`grep -rn "action: '"`), nicht nur den
gemeldeten Einzelfall reparieren – hier gab es acht weitere, bisher
unbemerkte Lücken.
