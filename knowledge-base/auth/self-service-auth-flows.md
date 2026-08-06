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
  `email-verification-banner.tsx`
- `apps/web/src/middleware.ts` (`/register` im Matcher ergänzt)

## Offene Punkte

- Echter Mail-Versand (SMTP/Provider) ist vorbereitet (ein Austausch von
  `MailerService`s Implementierung), aber nicht angebunden.
- Keine Rate-Begrenzung speziell für `forgot-password`/
  `resend-verification` über das globale Throttling hinaus (100 Req/Min
  pro IP gilt bereits projektweit).
