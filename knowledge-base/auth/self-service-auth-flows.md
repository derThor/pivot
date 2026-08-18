# Selbstbedienung: Registrierung, E-Mail-Verifikation, Passwort ändern/vergessen

**Datum:** 2026-08-03
**Betroffene Bereiche:** apps/api (`src/auth`, `src/mailer`), apps/web
(`src/app/register`, `verify-email`, `forgot-password`, `reset-password`,
`dashboard/account`)

## Was wurde gebaut

- **Registrierung**: `POST /auth/register` existierte bereits im Backend,
  aber ohne Frontend-Anbindung (keine Registrierungsseite). Jetzt: neue
  öffentliche Seite `/register` (prüft vorab `allowRegistration` aus den
  [Settings](./settings-and-password-policy.md), zeigt sonst einen
  Deaktiviert-Hinweis statt des Formulars), Formular mit Vorname
  (optional)/Nachname (Pflicht)/E-Mail/Passwort+Bestätigung.
- **E-Mail-Verifikation (Dev-Stub)**: `User.emailVerifiedAt`,
  `EmailVerificationToken` (gleiche Form wie `RefreshToken`: Hash in der
  DB, Klartext-Token nur einmal im Response/E-Mail-Versand). Neuer
  `MailerService` loggt die Mail nur (`Logger.log`) – **kein echter
  Versand**, da keine Mail-Infrastruktur existiert. Im Nicht-Production-
  Modus wird der Link zusätzlich direkt in der API-Antwort zurückgegeben
  (`verificationLinkDevOnly`), damit das Feature ohne Mail-Server
  vollständig end-to-end testbar ist. `GET /auth/verify-email?token=`
  (öffentlich) markiert den Token als benutzt und setzt
  `emailVerifiedAt`. **Login wird bei fehlender Verifikation nicht
  blockiert** – nur ein Banner im Dashboard (`EmailVerificationBanner`)
  mit "Erneut senden"-Button.
- **Passwort ändern (Self-Service)**: `PATCH /auth/password`
  (authentifiziert, aktuelles + neues Passwort), widerruft **alle**
  Refresh-Tokens des Users – auch die der aktuellen Session. Das Frontend
  (`ChangePasswordForm`) ruft nach erfolgreicher Änderung proaktiv
  `/api/auth/logout` auf und leitet zu `/login` weiter, statt zu
  riskieren, dass die Session in den nächsten ≤15 Minuten unbemerkt
  bricht (der Access-Token bleibt bis zu seinem natürlichen Ablauf gültig,
  auch wenn das Refresh-Token schon widerrufen ist).
- **Passwort vergessen**: `PasswordResetToken` (gleiche Form wie
  `EmailVerificationToken`), `POST /auth/forgot-password` (öffentlich,
  liefert bei unbekannter E-Mail dieselbe generische Antwort wie bei
  bekannter – verhindert User-Enumeration), `POST /auth/reset-password`
  (öffentlich, Token + neues Passwort, widerruft ebenfalls alle
  Refresh-Tokens). Öffentliche Seiten `/forgot-password` und
  `/reset-password` mit Dev-Link-Anzeige analog zur E-Mail-Verifikation.
- **Self-Service-Profil**: neuer Endpoint `PATCH /auth/me`
  (`UpdateProfileDto`: nur `firstName`/`lastName`/`email`, absichtlich
  ohne `roleId`/`isActive` – die bleiben admin-exklusiv über `PATCH
  /users/:id`). Beide Endpoints laufen durch dieselbe
  `UsersService`-Logik (E-Mail-Konflikt- und `allowEmailChange`-Prüfung),
  damit die Regel "E-Mail-Änderung global deaktivierbar" nicht nur für
  Admins gilt.
- Neue Konto-Seite `/dashboard/account` (Profil + Passwort ändern),
  Einstiegspunkt: Sidebar-Footer-User-Block wurde von einem reinen
  Anzeige-Button zu einem `DropdownMenu` (Komponente existierte bereits im
  Projekt) mit "Konto"/"Abmelden".

## Warum diese Lösung

- **Dev-Stub statt echtem Mail-Versand**: keine Mail-Infrastruktur
  vorhanden, ein echter Provider (SMTP/Resend/…) hätte Zugangsdaten vom
  Nutzer gebraucht. Der Link-in-Response-Ansatz macht E-Mail-Verifikation
  und Passwort-Reset trotzdem vollständig automatisiert testbar (siehe
  `apps/api/test/auth-security.e2e-spec.ts`, das den Token direkt aus der
  Response extrahiert).
- **Passwort-Änderung widerruft auch die eigene Session**: Konsistenz
  wichtiger als Bequemlichkeit – eine Passwort-Änderung ist ein
  sicherheitsrelevanter Vorgang; alle Sessions (inkl. der eigenen) enden
  zu lassen ist die verbreitete, konservative Standardwahl. Der
  proaktive Logout+Redirect im Frontend macht die tatsächliche
  Konsequenz sofort sichtbar statt sie 15 Minuten lang zu verschleiern.
- **`PATCH /auth/me` statt Wiederverwendung von `PATCH /users/:id`
  mit der eigenen ID**: `PATCH /users/:id` ist hinter
  `users:manage` gattert (nur Admin) – ein normaler User dürfte diesen
  Endpoint gar nicht aufrufen, auch nicht für die eigene ID. Ein
  separater, bewusst schmalerer Endpoint ohne Rollen-Anforderung (nur
  "eingeloggt") ist die korrekte Trennung von "verwalte irgendeinen User"
  und "verwalte mein eigenes Profil".

## Stolpersteine / Besonderheiten

- `AuthService.verifyEmail()` gab ursprünglich nichts zurück (leerer
  Response-Body) – ein direkter `fetch(...).json()`-Aufruf auf der
  `/verify-email`-Seite wäre daran gescheitert (leerer Body ist kein
  gültiges JSON). Fix: Methode gibt jetzt `{ message: '...' }` zurück,
  konsistent mit `resendVerification()`.
- Die `/verify-email`-Seite ruft das Backend **direkt** auf (nicht über
  einen `/api/...`-Route-Handler), weil sie die konkrete Fehlermeldung
  bei ungültigem/abgelaufenem Token braucht – ein genereller
  `publicApiFetch`-Helper, der bei Non-2xx nur `null` liefert (wie er für
  andere öffentliche Server-Component-Fetches genutzt wird), hätte diese
  Detail-Information verloren.

## Relevante Dateien

- `apps/api/src/auth/auth.service.ts`, `auth.controller.ts`,
  `dto/register.dto.ts`, `dto/change-password.dto.ts`,
  `dto/forgot-password.dto.ts`, `dto/reset-password.dto.ts`
- `apps/api/src/mailer/*`
- `apps/api/src/users/dto/update-profile.dto.ts`,
  `users.service.ts` (`updateProfile`)
- `apps/web/src/app/register`, `verify-email`, `forgot-password`,
  `reset-password`, `dashboard/account`
- `apps/web/src/components/register-form.tsx`,
  `change-password-form.tsx`, `forgot-password-form.tsx`,
  `reset-password-form.tsx`, `account-form.tsx`,
  `email-verification-banner.tsx`, `avatar-crop-dialog.tsx`,
  `my-account-view.tsx`, `account-lock-banner.tsx`
- `apps/web/src/middleware.ts` (`/register` im Matcher ergänzt)

## Offene Punkte

- Echter Mail-Versand (SMTP/Provider) ist vorbereitet (ein Austausch von
  `MailerService`s Implementierung), aber nicht angebunden.
- Keine Rate-Begrenzung speziell für `forgot-password`/
  `resend-verification` über das globale Throttling hinaus (100 Req/Min
  pro IP gilt bereits projektweit).

## Update 2026-08-17: "Mein Konto" komplett neu nach Bildvorlage

`/dashboard/account` (`AccountTabs`, 2 Tabs Profil/Sicherheit) ersetzt durch
`MyAccountView` (`apps/web/src/components/my-account-view.tsx`), 4 Tabs nach
Bildvorlage: Profil/Sicherheit/Darstellung/Benachrichtigungen, optisch an
`UserEditView` (Benutzer-Profilseite, siehe
[user-profile-page-plan.md](./user-profile-page-plan.md)) angelehnt –
Kopf-Karte (Avatar, Name, Rollen-Badges, "2FA aktiv"-Badge, "Dabei seit"),
darunter Tabs-Karte mit Hauptspalte + Sidebar-Karten.

**Vorab per Bewertung geklärt (Nutzerentscheidung 2026-08-17):** Die
Bildvorlage zeigte etliche Funktionen, die es in dieser App nicht gibt
(Sprache/Zeitzone, Freigabe-Workflow, Kommentare, Formular-Einsendungen,
Deploy-Status, Produktneuigkeiten, Tastaturkürzel – Letztere sind im Code
gar nicht implementiert) – **nicht** nachgebaut (kein erfundener Wert, siehe
[[project_two_factor_auth]]-Konvention). Stattdessen:

- **Profil**: `AccountForm` um `department`/`phone` erweitert (Felder
  existierten am `User`-Model bereits, waren aber nur im admin-seitigen
  `UpdateUserDto` exponiert – jetzt zusätzlich in `UpdateProfileDto`).
  Sidebar "Meine Rolle" (echte `Role.description`, per `getRoles()` serverseitig
  zur User-Rolle gematcht) + "Diese Woche" (echte Wochenzahlen, siehe unten
  – **nicht** die Lebenszeit-Summe wie bei `UserEditView`, und **ohne**
  "Freigaben"-Kachel, da es keinen Freigabe-Workflow gibt).
- **Sicherheit**: `ChangePasswordForm` + `TwoFactorSetupCard` (überarbeitet,
  siehe unten) + Sidebar "Meine Sitzungen" (kompakte Variante ohne
  Pagination, im Gegensatz zur paginierten Version in `UserEditView`).
- **Darstellung/Benachrichtigungen**: reine "in Vorbereitung"-Platzhalter-
  Tabs, exakt das bestehende Muster von `UserEditView`s "Aktivität"-Tab
  übernommen (`rounded-xl border` + `h2` + grauer Hinweistext).
- **"Daten exportieren"** aus der Bildvorlage: weggelassen, kein
  Export-Endpoint vorhanden.

**Neue `/auth/me/*`-Routen statt `/users/:id/*`:** `getStats`/`getUserStats`,
`listSessions`/`getUserSessions` etc. verlangen `users:read`/`users:update`
– ein Nutzer ohne dieses Recht (z.B. Rolle "Gast") muss seine **eigenen**
Daten trotzdem sehen können. Neu:
- `GET /auth/me/stats` → `UsersService.getWeeklyStats()` (neu, wochenbezogen
  statt Lebenszeit-Summe wie `getStats()`; Wochenstart = Montag 00:00 lokal).
- `GET /auth/me/sessions`, `DELETE /auth/me/sessions/:id`,
  `POST /auth/me/sessions/revoke-others` – rufen dieselben
  `AuthService.listSessions()`/`revokeSession()`/`revokeOtherSessions()`
  auf wie die Admin-Routen, nur mit `user.sub` statt `:id`.
- `POST /auth/me/avatar` (multipart) – **eigener Endpoint statt direkt
  `POST /media`**: Letzterer verlangt `media:create`, das z.B. "Gast" nicht
  hat, aber jeder Nutzer soll sein eigenes Foto ändern dürfen. Ruft intern
  `MediaService.create()` auf (`UsersModule` importiert dafür neu
  `MediaModule`), ohne eigenen Ordner (bewusst kein "Avatare"-Systemordner
  wie beim Firmenlogo – Scope-Entscheidung, siehe
  [settings-and-password-policy.md](./settings-and-password-policy.md)).
  Rendert jetzt auch echt (`AvatarImage`) statt nur Initialen-Fallback, in
  `MyAccountView`s Kopf-Karte **und** in `dashboard-header.tsx`s
  Nutzer-Dropdown (vorher überall nur `AvatarFallback`, nirgends
  `AvatarImage` verwendet).

**2FA-Kartenüberarbeitung** (`two-factor-setup-card.tsx`, siehe
[two-factor-authentication.md](./two-factor-authentication.md)): neues
Feld `User.twoFactorEnabledAt` (nur Anzeige, "eingerichtet am ...", gesetzt
in `verifyTwoFactorSetup()`, zurückgesetzt bei jeder Deaktivierung – **kein
erfundener Wert** wie die Lebenszeit-Aktivitätszahlen an anderer Stelle).
Aktivierter Zustand jetzt: grüne Statuszeile + "Neu einrichten" (startet den
QR-Flow erneut, überschreibt Secret+Codes) + "Neue Codes generieren"
(`POST /auth/2fa/regenerate-recovery-codes`, neuer Endpoint, ersetzt die
gehashten alten Codes komplett – die Bildvorlage zeigte
"Wiederherstellungscodes anzeigen", was technisch nicht geht, da Codes
gehasht gespeichert sind) + dezenter Text-Link "Deaktivieren" darunter
(Bildvorlage zeigte keinen Deaktivieren-Weg, blieb aber aus
Sicherheits-/Vollständigkeitsgründen nötig).

### Nachtrag (selbiger Tag): `mustChangePassword`/`twoFactorSetupRequired` blieben unsichtbar

Direkt nach dem Ausrollen des obigen 2FA-Ausbaus meldete der Nutzer einen
Lockout: als Administrator plötzlich überall "keine Berechtigung", nachdem
`mustChangePassword` für das eigene Konto gesetzt wurde. Ursache: **beide
Guards** (`PasswordChangeGuard`, `TwoFactorSetupGuard`) sperrten zwar
korrekt alle Routen außer den erlaubten – aber das Frontend hatte dafür
*keinerlei* Behandlung. Jede blockierte Seite fiel einfach auf ihren
generischen "Keine Berechtigung"/leer-Zustand zurück, ohne dass der Nutzer
erfuhr, warum.

**Fix, zwei Teile:**
1. **`GET /auth/me`** liefert jetzt zusätzlich `twoFactorSetupRequired`
   (aus dem JWT-Payload, war vorher nur `mustChangePassword` – das Feld
   existierte bereits direkt am `User`-Model und wurde schon durchgereicht).
2. **`apps/web/src/middleware.ts`**: dekodiert das Access-Token (nur zur
   UX-Entscheidung, **keine** Signaturprüfung nötig – die eigentliche
   Durchsetzung bleibt serverseitig bei den Guards) und leitet jede
   `/dashboard/*`-Seite außer `/dashboard/account` automatisch dorthin um,
   sobald `mustChangePassword` oder `twoFactorSetupRequired` gesetzt ist.
   `atob()` statt `Buffer.from()` fürs Base64url-Decoding, da Next.js
   Middleware standardmäßig im Edge-Runtime läuft (kein Node-`Buffer`).
3. **`AccountLockBanner`** (neu, `dashboard/layout.tsx`, gleiches Muster wie
   `EmailVerificationBanner`/`ImpersonationBanner`): erklärt oben auf jeder
   Seite (inkl. der Zielseite selbst), warum umgeleitet wurde, mit
   Direktlink. `MyAccountView` öffnet in diesem Zustand automatisch den
   Sicherheit-Tab statt Profil.

**Verifiziert** per Playwright: Login mit `mustChangePassword` → Redirect
zu `/dashboard/account?reason=password`, Banner + Sicherheit-Tab offen;
manuelle Navigation zu `/dashboard/users` → sofort zurückgeschickt.
Gleiches für `reason=2fa` (Administrator + `requireTwoFactorForAdmins`).

### Korrektur (selbiger Tag): Kopf-Karte wich von `UserEditView` ab

Erster Wurf der Kopf-Karte in `MyAccountView` nutzte fälschlich das
generische `PageContent`-Kartenmuster (`rounded-[10px] shadow-sm p-6`,
Standard-Avatar mit grauem `AvatarFallback`) statt exakt die Kopf-Karte aus
`UserEditView` zu übernehmen (`rounded-xl border border-[#E5E5E5] p-4`,
`Avatar size="lg" className="size-14"` mit dunklem
`bg-neutral-900 text-white`-Fallback). Auf Nutzer-Korrektur ("orientiere
dich an Benutzer ändern Detailseite") 1:1 angeglichen – gilt als
verbindliche Referenz für die Kopf-Karten-Optik auf **beiden** Seiten
(Benutzer-Profilseite **und** Mein Konto), nicht das generische
`PageContent`-Muster.

### Update (selbiger Tag): "Daten exportieren"-Button, echte Funktion

Auf Bildvorlage zunächst bewusst weggelassen (kein Backend-Endpoint,
keine erfundene Funktion – siehe ursprüngliche Bewertung oben), auf
explizite Nutzeranfrage nachträglich doch gebaut, **inklusive echter
Funktion** ("und die Funktion"). Neue, wiederverwendete Komponente
`export-profile-button.tsx`, in `MyAccountView` (neben "Profil
speichern") **und** `UserEditView` (neben "Passwort zurücksetzen") –
exportiert jeweils den gerade angezeigten Nutzer (sich selbst bzw. den
von einem Admin betrachteten Nutzer).

- **Kein Backend-Endpoint nötig**: identisches Muster wie
  `RolesExplorerExportButton` in `roles-explorer.tsx` – die Daten liegen
  bereits geladen im Browser, ein `Blob` +
  `URL.createObjectURL()` + temporärer `<a download>`-Klick reicht.
  Datei landet als `<email>.json` im Download-Ordner.
- **Bewusst nur "persönliche" Felder** (Name, E-Mail, Abteilung, Telefon,
  Rollen, Status, E-Mail-Bestätigung, 2FA-Status/-Datum, erstellt/letzter
  Login) – keine internen Felder wie `failedLoginAttempts`,
  `permissions`, `mustChangePassword` oder `avatarUrl`, ähnlich einem
  einfachen DSGVO-Datenauszug.
- Per Playwright verifiziert: echter Download ausgelöst, Inhalt der
  heruntergeladenen Datei stichprobenartig geprüft.

### Update (selbiger Tag): eigener, nicht löschbarer "Avatare"-Ordner

Auf Nutzervorgabe landen Profilfotos jetzt in einem eigenen Systemordner
"Avatare" statt im Wurzelverzeichnis der Medienbibliothek – exakt dasselbe
Muster wie der bestehende "Logo"-Ordner (siehe
[settings-and-password-policy.md](./settings-and-password-policy.md)):
`MediaFolder.isSystem` schützt den **Ordner** vor dem Löschen
(`MediaFoldersService.remove()` wirft bereits vorher `BadRequestException`
bei `isSystem`), einzelne Bilder darin lassen sich ganz normal über
`DELETE /media/:id` löschen wie jedes andere Medium – per E2E-Test
verifiziert (Ordner-Löschversuch → 400, Bild-Löschversuch → 200).

- **Seed** (`packages/database/prisma/seed.ts`): zweiter idempotenter
  Block nach dem bestehenden Logo-Block, gleiches "finde oder erstelle,
  hebe `isSystem` nach falls nötig"-Muster. Musste per `pnpm --filter
  @pivot/database seed` einmalig gegen die laufende Dev-DB nachgezogen
  werden (Seed läuft nicht automatisch bei Schema-Änderungen).
- **`UsersService.updateAvatar()`**: löst die Ordner-ID jetzt serverseitig
  selbst auf (`prisma.mediaFolder.findFirst({ name: 'Avatare', isSystem:
  true })`) statt sie wie beim Logo vom Frontend durchreichen zu lassen –
  der Self-Service-Avatar-Endpoint hat keinen Seiten-Kontext, der das
  liefern könnte. Degradiert weich auf "kein Ordner" (Wurzel), falls der
  Seed noch nicht gelaufen ist.
- **Altes Foto wird beim Ersetzen aufgeräumt** (gleiches Verhalten wie
  beim Logo-Ersetzen): `updateAvatar()` sucht nach dem alten
  `avatarUrl` in `Media` (gescoped auf `uploadedById`) und löscht die
  Zeile+Datei, bevor die neue URL gespeichert wird – sonst sammeln sich
  bei jedem erneuten Hochladen verwaiste Dateien im Ordner an. Per E2E
  verifiziert: nach zweitem Upload existiert nur noch eine `Media`-Zeile
  für den Nutzer.
- **Stolperstein, vorab gefixt:** `dashboard/settings/page.tsx`s
  Logo-Ordner-Lookup filterte bisher nur nach `folder.isSystem` (`folders
  .find(f => f.isSystem)`) – funktionierte, solange es nur *einen*
  System-Ordner gab. Mit dem neuen "Avatare"-Ordner wäre das Ergebnis
  nicht mehr deterministisch gewesen (könnte den falschen Ordner für den
  Logo-Upload liefern, je nach Sortierreihenfolge). Vorsorglich auf
  `folder.isSystem && folder.name === "Logo"` verschärft, **bevor** das
  zum echten Bug wurde.
- **Bildausgabe bei gelöschtem Avatar-File:** kein Zusatzcode nötig – Base
  UIs `Avatar`-Primitive fällt beim Ladefehler des `AvatarImage`
  automatisch auf `AvatarFallback` (Initialen) zurück. Per Test
  verifiziert: darunterliegendes Medium gelöscht (`User.avatarUrl` zeigt
  auf 404) → Kopf-Karte zeigt sauber die Initialen, kein kaputtes
  Bild-Icon.

### Update (selbiger Tag): Avatar-Zuschnitt + Avatar überall rendern

Zwei Nachträge zum Self-Service-Avatar-Upload (`POST /auth/me/avatar`,
siehe oben):

- **Zuschnitt vor dem Hochladen** (`avatar-crop-dialog.tsx`, neu): anders
  als `media-crop-dialog.tsx` (schneidet ein bereits in der Bibliothek
  liegendes Medium serverseitig zu einem **neuen, zusätzlichen** Medium
  zu – sinnvoll für Bibliotheks-Assets, aber ein Profilfoto soll kein
  verwaistes Original + ein zweites zugeschnittenes Medium hinterlassen)
  läuft der Zuschnitt hier komplett **clientseitig** auf der noch nicht
  hochgeladenen Datei: `react-image-crop`s `cropToCanvas()`-Helper zeichnet
  den gewählten Ausschnitt in ein `<canvas>`, `canvas.toBlob()` liefert das
  Ergebnis, das als einzige Datei an `/auth/me/avatar` geht. Quadratisch
  fest vorgegeben (`aspect={1}`, `circularCrop` für die Vorschau), zentrierter
  Vorschlag beim Laden (`centerCrop`+`makeAspectCrop` auf 90% der
  Bildbreite). Kein Backend-Aufwand nötig – reine Frontend-Ergänzung.
- **Avatar wurde nicht überall gerendert**: `AvatarImage` fehlte in
  `user-edit-view.tsx` (Kopf-Karte der admin-seitigen Benutzer-Profilseite)
  und `users-table.tsx` (Zeilen-Avatar) – beide zeigten trotz gesetztem
  `avatarUrl` nur die Initialen-`AvatarFallback`. Beide um denselben
  `{user.avatarUrl && <AvatarImage src={mediaUrl({url: user.avatarUrl})} />}`-
  Zweig ergänzt wie bereits in `my-account-view.tsx`/`dashboard-header.tsx`.
  **Alle** vier `Avatar`-Nutzungsstellen im Projekt rendern das Bild jetzt
  konsistent (per Grep verifiziert – keine fünfte Stelle vorhanden).

### Zweite Korrektur (selbiger Tag): globaler Hintergrund über Tabs+Inhalt

Derselbe Fehler wiederholte sich beim Tabs-Bereich: `MyAccountView` wrapte
`<Tabs>` (TabsList **und** alle TabsContent-Bereiche) in einen gemeinsamen
`PageContent`-Container (`rounded-[10px] bg-card shadow-sm`) – ein
durchgehender weißer Hintergrund über Tab-Leiste + Profil-Formular +
Sidebar-Karten hinweg. `UserEditView` macht das anders: `<Tabs>` sitzt
**ohne** umschließende Karte direkt auf dem grauen Seitenhintergrund, jede
Sektion (Stammdaten, Aktivität, Anmeldung+Sitzungen, Konto-Info) ist eine
**eigene** `rounded-xl border border-[#E5E5E5] bg-card p-6`-Karte.

**Fix:** `PageContent`-Wrapper um `<Tabs>` entfernt (Tabs bekommen direkt
`className="gap-4"`). `AccountForm`, `ChangePasswordForm`,
`TwoFactorSetupCard` nutzten für ihre `Card` bisher `border-none
bg-transparent shadow-none` (verließen sich auf den jetzt entfernten
äußeren Rahmen) – alle drei auf `rounded-xl border-[#E5E5E5] shadow-none`
umgestellt, damit sie als eigenständige Karten sichtbar bleiben. Ergebnis
im Sicherheit-Tab: zwei gestapelte Karten (Passwort + 2FA) statt einer
gemeinsamen wie in `UserEditView` – bewusst nicht zusammengelegt (kleinerer,
risikoärmerer Fix, adressiert genau den gemeldeten Fehler: den
durchgängigen Hintergrund über *mehrere Tabs/Bereiche* hinweg, nicht die
Kartenanzahl innerhalb eines Tabs).

### Nachtrag 2026-08-17: "Alle anderen Sitzungen beenden" als Button statt Link

In beiden Sitzungslisten (`my-account-view.tsx` und `user-edit-view.tsx`,
Tab "Sicherheit" bzw. Sektion "Anmeldung & Sitzungen") war
"Alle anderen Sitzungen beenden" bisher ein reiner `Button
variant="link"` (px-0, kein Rahmen, wirkte wie Fließtext). Per Bildvorlage
auf einen vollbreiten, umrandeten Button umgestellt: `variant="outline"
className="w-full justify-center rounded-xl border-[#E5E5E5] text-destructive
hover:bg-destructive/5 hover:text-destructive"` – neutraler grauer Rahmen
(wie die übrigen `border-[#E5E5E5]`-Karten der Seite, nicht der rötlich
getönte `destructive`-Button-Variant), roter Text. Zunächst `w-full
justify-center` (volle Breite der Sitzungsliste) umgesetzt, auf
Rückmeldung hin auf `self-start` (Button so breit wie sein Text,
button-typisch statt bannerartig) korrigiert. Per Playwright-Screenshot
gegen die Bildvorlage verifiziert.
