# Einstellungen → Sicherheit: sieben neue, echte Sicherheits-Features

**Datum:** 2026-08-17
**Betroffene Bereiche:** apps/api (`src/auth`, `src/settings`, `src/common/utils/pwned-password.ts`),
apps/web (`src/components/settings-form.tsx`), `packages/database/prisma/schema.prisma`

## Was wurde gebaut

Der "Sicherheit"-Tab der Einstellungsseite (siehe
[settings-page-redesign.md](../frontend/settings-page-redesign.md)) wurde
nach Bildvorlage umgebaut. Anders als beim ersten Sidebar-Umbau hat der
Nutzer sich hier explizit für **"Alles jetzt als echte Funktion bauen"**
entschieden (AskUserQuestion) – alle sieben neuen Funktionen aus der
Bildvorlage sind daher mit echter Backend-Logik verdrahtet, keine reinen
UI-Attrappen. Einzige bewusste Auslassung: **"Anmeldung auf Firmennetz
beschränken"** (IP-Range-Login-Beschränkung) – auf ausdrücklichen
Nutzerwunsch weggelassen, deckt sich mit der bereits in `docs/ROADMAP.md`
(2b.14) vermerkten Entscheidung, dieses Feature nicht zu bauen.

### Schema (`AppSettings`, `User`, `RefreshToken`, neues `PasswordHistory`)

- `AppSettings.passwordExpiryDays Int?` (null = kein Ablauf)
- `AppSettings.failedLoginLockoutThreshold Int?` (null = keine automatische Sperre)
- `AppSettings.passwordBlockLeaked Boolean`
- `AppSettings.passwordPreventReuseEnabled Boolean` (feste Anzahl 5)
- `AppSettings.requireTwoFactorForAll Boolean`, `requireTwoFactorForPublishers Boolean`
  (zusätzlich zum bestehenden `requireTwoFactorForAdmins`, auf Nutzerwunsch
  "für Administratoren beibehalten")
- `AppSettings.sessionIdleTimeoutMinutes Int?` (null = kein Timeout)
- `User.passwordChangedAt DateTime?` – Grundlage für den Ablauf-Check,
  bewusst `NULL` für Bestandskonten statt eines erfundenen
  Rückwirkungs-Zeitpunkts (läuft dann nie ab, bis das Passwort das erste
  Mal nach Einführung dieses Felds geändert wird)
- `RefreshToken.lastUsedAt DateTime @default(now())` – Grundlage für den
  Inaktivitäts-Timeout
- Neues Modell `PasswordHistory { userId, passwordHash, createdAt }` –
  argon2-gehashte frühere Passwörter, für die Wiederverwendungs-Sperre

### 1. Segmentierte Presets statt freier Zahlenfelder

Mindestlänge (8/10/12/16), Passwort-Ablauf in Tagen (90/180/365/nie),
Sperre nach Fehlversuchen (3/5/10/nie) – neue `SegmentedPicker`-Komponente
in `settings-form.tsx` (weißer Pillen-Button für den aktiven Wert
innerhalb eines grauen Tracks), 1:1 nach Bildvorlage statt der bisherigen
freien `<Input type="number">` für die Mindestlänge.

### 2. Automatische Kontosperre nach N Fehlversuchen

`AuthService.login()`: bei falschem Passwort wird `failedLoginAttempts`
hochgezählt; erreicht der neue Wert `failedLoginLockoutThreshold`, wird
zusätzlich `isActive: false` gesetzt – **derselbe Zustand wie die
bestehende manuelle "Sperren"-Aktion** (`UsersService.remove()`/
"Gesperrt"-Badge/"Entsperren"-Button in `UserEditView`), kein neues
Feld/keine neue UI nötig. Vorher gab es laut Schema-Kommentar nur die
Anzeige des Zählers, keine automatische Sperre. Per `curl` gegen die
laufende API verifiziert: 3 Fehlversuche → `isActive=false`, danach
lehnt selbst das korrekte Passwort mit "Konto ist deaktiviert." ab.

### 3. Passwort-Ablauf

`AuthService.login()`: bei erfolgreichem Login wird geprüft, ob
`Date.now() - user.passwordChangedAt > passwordExpiryDays` – falls ja,
wird `mustChangePassword: true` gesetzt (**derselbe Mechanismus** wie
"Passwortwechsel bei nächster Anmeldung erzwingen", inkl. bestehendem
`AccountLockBanner`/`PasswordChangeGuard`). `passwordChangedAt` wird bei
jeder Passwort-Setzung aktualisiert (Registrierung, Self-Service-Änderung,
Reset-Link).

### 4. Geleakte Passwörter blockieren

Neue Utility `common/utils/pwned-password.ts`: k-Anonymitäts-Abfrage
gegen die Have-I-Been-Pwned-API (`https://api.pwnedpasswords.com/range/`)
– nur die ersten 5 Zeichen des SHA-1-Hashes werden übertragen, das
Klartext-Passwort verlässt den Server nie. Bei Nichterreichbarkeit der
API wird **nicht** blockiert (Zusatzsicherung, keine Kernfunktion – kein
Denial-of-Service durch einen Drittanbieter-Ausfall). Geprüft bei
Registrierung, Self-Service-Passwortwechsel und Passwort-Reset. Live
gegen die echte API verifiziert: `Password123!` wird abgelehnt, ein
zufällig generiertes starkes Passwort wird angenommen.

### 5. Passwort-Wiederverwendung verhindern

Neues `PasswordHistory`-Modell, `AuthService.assertPasswordNotReused()`
prüft ein neues Passwort per `argon2.verify()` gegen den aktuellen Hash +
die letzten 4 History-Einträge (zusammen 5). `recordPasswordHistory()`
schreibt bei jeder Passwort-Änderung einen neuen Eintrag und löscht
Einträge jenseits der letzten 5.

### 6. Gestaffelte 2FA-Pflicht

`AuthService.issueTokens()`: `twoFactorSetupRequired` ist jetzt eine
ODER-Verknüpfung aus drei unabhängigen Stufen –
`requireTwoFactorForAll` (jedes Konto), `requireTwoFactorForAdmins`
(Rolle "Administrator", **bestehendes Feld, auf Nutzerwunsch
beibehalten**), `requireTwoFactorForPublishers` (jede Rolle mit dem Recht
`content:publish`, geprüft über das bereits berechnete `permissions`-Array).
`TwoFactorSetupGuard` selbst brauchte keine Änderung – er liest nur die
fertig berechnete JWT-Claim.

### 7. Sitzungs-Inaktivitäts-Timeout

`AuthService.refresh()`: vor der Token-Rotation wird geprüft, ob seit
`RefreshToken.lastUsedAt` mehr als `sessionIdleTimeoutMinutes` vergangen
sind – falls ja, wird das Token widerrufen und der Refresh abgelehnt,
statt zu rotieren. Funktioniert ohne zusätzliche Frontend-Aktivitäts-
Erkennung: die Middleware (`middleware.ts`) ruft `/auth/refresh` nur bei
tatsächlichen Seitenaufrufen/Requests auf, ein wirklich untätiger Tab löst
keine neuen Anfragen aus – `lastUsedAt` der jeweils aktuellen
Refresh-Token-Zeile entspricht dadurch bereits "Zeitpunkt der letzten
Aktivität". UI bindet das bewusst als einfachen Schalter (fixer Wert 480
Minuten = 8 Std. bei "an", `null` bei "aus"), nicht als Segmented-Picker –
so zeigt es auch die Bildvorlage.

### 8. Globale Admin-Aktionen

Zwei neue Endpunkte (`POST /settings/revoke-all-sessions`,
`POST /settings/force-password-reset-all`, Berechtigung
`settings:update`, in `AuthService` implementiert, über `SettingsController`
exponiert – `forwardRef()` zwischen `AuthModule`/`SettingsModule` nötig,
da `AuthModule` bereits `SettingsModule` importiert):
- **"Alle Sitzungen beenden"**: widerruft jedes nicht-widerrufene
  `RefreshToken` systemweit.
- **"Passwort-Reset für alle erzwingen"**: setzt `mustChangePassword: true`
  für jedes aktive, nicht anonymisierte Konto (gleicher Mechanismus wie
  die Einzelnutzer-Variante, kein sofortiger Zwangs-Logout).

Beide über `ConfirmDeleteDialog` bestätigungspflichtig (Bestätigungsdialog
per Playwright verifiziert). **Bewusst nicht per Playwright real
ausgelöst**, um echte Konten (inkl. `admin@pivot.dev`) nicht ungewollt zu
beeinträchtigen – Logik stattdessen per Code-Review abgesichert, da beide
einfache, symmetrische `updateMany()`-Aufrufe sind.

## Abweichungen von der Bildvorlage

- **Passwort-Richtlinie-Untertitel**: Bildvorlage zeigt "Gilt für alle
  Konten außer Systemintegrationen." – es gibt kein
  Systemintegrations-/Service-Account-Konzept in dieser App, die
  ursprüngliche, zutreffende Beschreibung wurde beibehalten.
- **"Sonderzeichen erforderlich"** (bestehendes, echtes Feld
  `passwordRequireSpecialChar`) taucht in der Bildvorlage nicht auf –
  trotzdem als eigener Schalter erhalten, um keine echte Funktion aus der
  UI zu entfernen. "Groß-/Kleinschreibung und Zahl erforderlich" ist ein
  einzelner UI-Schalter, der die drei getrennten Felder
  (`passwordRequireUppercase/Lowercase/Number`) gemeinsam setzt – die
  Felder selbst bleiben granular im Schema.

## Relevante Dateien

- `packages/database/prisma/schema.prisma`
- `apps/api/src/common/utils/pwned-password.ts` (neu)
- `apps/api/src/auth/auth.service.ts` (`login`, `refresh`, `register`,
  `changePassword`, `resetPassword`, `issueTokens`, neue private Helfer
  `assertPasswordNotLeaked`/`assertPasswordNotReused`/
  `recordPasswordHistory`, neue öffentliche `revokeAllSessionsGlobally`/
  `forcePasswordResetForAllUsers`)
- `apps/api/src/auth/guards/two-factor-setup.guard.ts` (nur Kommentar
  aktualisiert, Logik unverändert)
- `apps/api/src/settings/dto/update-settings.dto.ts`,
  `settings.controller.ts`, `settings.module.ts` (neue `forwardRef`)
- `apps/web/src/components/settings-form.tsx` (`SegmentedPicker`, neuer
  "Anmeldung"-Card-Inhalt)
- `apps/web/src/lib/api-server.ts` (`AppSettings`-Interface)
- `apps/web/src/app/api/settings/{revoke-all-sessions,force-password-reset-all}/route.ts` (neu)

## Offene Punkte

- Kein e2e-Test für Passwort-Historie/-Wiederverwendung (nur per
  Code-Review abgesichert, nicht live gegen die API getestet).
- Die beiden globalen Admin-Aktionen wurden aus Vorsicht nicht live
  ausgelöst (siehe oben) – funktional ungetestet über die tatsächliche
  UI-Bestätigung hinaus.
- `sessionIdleTimeoutMinutes` als einfacher Ein/Aus-Schalter (fix 8 Std.)
  statt konfigurierbarer Dauer – Bildvorlage zeigt für dieses Feld keine
  Zahlenauswahl, anders als bei Mindestlänge/Ablauf/Sperre.
