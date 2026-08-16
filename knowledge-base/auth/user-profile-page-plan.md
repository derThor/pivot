# Benutzer bearbeiten: volle Profilseite

**Datum:** 2026-08-16
**Status:** Umgesetzt. Mehrfach-Rollen-Migration, neue Seite mit den Tabs
Profil/Zugang & Sicherheit (Aktivität nur Platzhalter), Anonymisierung,
Impersonation, erzwungener Passwortwechsel, Sitzungsverwaltung und
nutzerbezogene Systembenachrichtigungen sind gebaut und live getestet.
**Vollständige Aufgabenliste:** [docs/ROADMAP.md](../../docs/ROADMAP.md),
Abschnitt "2b.14 – Benutzer bearbeiten: volle Profilseite statt Dialog".

## Was gebaut wurde

Der Stift in der Benutzer-Tabelle (`user-row-actions.tsx`) führt jetzt auf
eine eigene Seite (`/dashboard/users/[id]/edit`, `UserEditView`-Komponente)
statt das bisherige `EditUserDialog`-Popup zu öffnen (Datei gelöscht) – nach
vorgelegter Bildvorlage: Kopfbereich mit Avatar/Status-Badges/
Schnellaktionen, Tabs Profil / Zugang & Sicherheit / Aktivität.

**Mehrfach-Rollen** (`User` n:m `Role` über `UserRole`) ist eigenständig
dokumentiert in [rbac-rework.md](./rbac-rework.md) (Update 2026-08-16) –
Voraussetzung für alles Weitere hier.

**Neue `User`-Felder:** `department`, `phone`, `mustChangePassword`,
`failedLoginAttempts`, `anonymizedAt`, `pendingActivation` (Details/Warum
siehe Schema-Kommentare in `packages/database/prisma/schema.prisma`).

**"Benutzer löschen" = Anonymisierung, kein Hard-Delete.** Löst den
scheinbaren Widerspruch zum bestehenden Soft-Delete-Entscheid
(`UsersService.remove()`, siehe rbac-rework.md, Hard-Delete brach an
`contents_authorId_fkey`) auf: die bestehende Deaktivierung bleibt die
schnelle, reversible "Sperren"-Aktion (`DELETE /users/:id`); neu ist
`UsersService.anonymize()` (`POST /users/:id/anonymize`, eigenes Recht
`users:delete`) – nicht reversibel, entfernt E-Mail/Name/Avatar/
Passwort-Hash (Login danach unmöglich), behält Zeile/`id` für gültige
Content-FKs, setzt `anonymizedAt`. "Konto entfernen" (zweite Stelle der
Bildvorlage) nutzt dieselbe Aktion, kein separates "Ehemaliger
Mitarbeiter"-Platzhalter-Nutzer-Konzept. Ein anonymisierter Nutzer kann
nicht mehr über `update()` bearbeitet werden (expliziter Check).

**"Als Nutzer ansehen" (Admin-Impersonation)** – `AuthService.
impersonate()`, `POST /users/:id/impersonate`, eigenes Recht
`users:impersonate`: kurzlebiger Access-Token (15 Min., **kein**
Refresh-Token), `impersonatedBy`-Claim im JWT-Payload, Audit-Log-Eintrag
(`AuditLog`, existierte bereits), Ausschluss von Administrator-
Zielnutzern und Selbst-Impersonation. Frontend-Cookie-Choreografie in den
Next.js-Route-Handlern `POST /api/users/[id]/impersonate` (sichert eigene
Tokens unter `admin_access_token`/`admin_refresh_token`) und
`POST /api/auth/stop-impersonation` (stellt sie wieder her) – siehe
`apps/web/src/lib/auth.ts`. Durchgängiger `ImpersonationBanner` in
`dashboard/layout.tsx`, solange `impersonatedBy` gesetzt ist.

**Erzwungener Passwortwechsel** (`mustChangePassword`): globaler
`PasswordChangeGuard` (`apps/api/src/auth/guards/password-change.guard.ts`,
in `AuthModule` zwischen `JwtAuthGuard` und `PermissionsGuard`
registriert) blockt alle Routen außer den mit
`@AllowPasswordChangeRequired()` markierten (`GET/PATCH /auth/me`,
`PATCH /auth/password`), sobald das JWT `mustChangePassword: true` trägt.
Wird beim erfolgreichen Passwortwechsel zurückgesetzt.

**Fehlversuche:** `AuthService.login()` inkrementiert
`failedLoginAttempts` bei falschem Passwort, setzt bei erfolgreichem
Login zurück – aktuell nur Anzeige, keine automatische Sperre nach X
Versuchen.

**Aktive Sitzungen:** `RefreshToken` trägt jetzt `userAgent`/`ipAddress`
(gesetzt bei Login/Refresh). Die rohen Header kommen von Next.js'
server-seitigen `fetch()`-Aufrufen (Middleware-Refresh, Login-Route) und
wurden zunächst NICHT durchgereicht (Bug: jede Sitzung zeigte "Unbekanntes
System", da Node statt dem Browser als User-Agent ankam) – jetzt explizit
weitergereicht, `apps/api/src/auth/auth.controller.ts`s `requestMeta()`
bevorzugt `x-forwarded-for` vor `req.ip` aus demselben Grund.
`AuthService.listSessions()`/`revokeSession()`/`revokeOtherSessions()` +
entsprechende `/users/:id/sessions*`-Endpunkte, `summarizeUserAgent()`
(`apps/api/src/common/utils/user-agent.ts`) parst grob OS/Browser per
Regex statt einer zusätzlichen npm-Abhängigkeit. Sitzungsliste im
Frontend paginiert über die (dafür um einen `onPageChange`-Callback-Modus
erweiterte) gemeinsame `PaginationControls`-Komponente statt einer
eigenen Lösung.

**Bewusst ausgelassen** (Nutzervorgabe): Website-Zugriff-Sektion (kein
Multi-Site-Konzept), Benachrichtigungen-Sektion (kein Notification-System
für Website-Zugriff), "Anmeldung nur aus Firmennetz". "Aktivität"-Tab nur
Platzhalter, keine echten Zahlen. 2FA-Toggle bleibt ein deaktivierter
Platzhalter-Switch (echte Umsetzung eigenes, späteres Vorhaben, Phase 3) –
seine Aus-Farbe (helles Blaugrau statt ausgegrautem `opacity-50`) ist
seit dieser Änderung der globale Stil für JEDEN ausgeschalteten Switch in
der App (`ui/switch.tsx`), nicht nur diesen einen.

**Nutzerbezogene Systembenachrichtigungen** (wartende Freischaltungen,
auffällige Fehlversuche, anstehende Passwortwechsel) sind eigenständig
dokumentiert in
[toast-and-system-messages.md](../frontend/toast-and-system-messages.md)
(Update 2026-08-16), inkl. der neuen Ab-/anschaltbarkeit pro Kategorie
und dem dafür gebauten [CacheService](../tooling/backend-caching.md).

## Relevante Dateien

- `packages/database/prisma/schema.prisma` (`User`, `UserRole`,
  `RefreshToken`, `AppSettings.notify*`)
- `apps/api/src/auth/*` (`auth.service.ts`, `auth.controller.ts`,
  `guards/password-change.guard.ts`,
  `decorators/allow-password-change-required.decorator.ts`)
- `apps/api/src/users/*` (`users.service.ts`, `users.controller.ts`,
  DTOs)
- `apps/api/src/common/utils/user-agent.ts`
- `apps/web/src/components/user-edit-view.tsx`,
  `impersonation-banner.tsx`, `user-row-actions.tsx`, `users-table.tsx`
- `apps/web/src/app/dashboard/users/[id]/edit/page.tsx`
- `apps/web/src/app/api/users/[id]/{anonymize,impersonate,reset-password,
  sessions}/route.ts`, `apps/web/src/app/api/auth/stop-impersonation/route.ts`
- `apps/web/src/lib/auth.ts` (`ADMIN_ACCESS_TOKEN_COOKIE`/
  `ADMIN_REFRESH_TOKEN_COOKIE`), `apps/web/src/middleware.ts`

## Offene Punkte

- "Aktivität"-Tab bleibt Platzhalter, keine echte Historie (bewusst,
  siehe oben).
- Keine automatische Konto-Sperre nach X Fehlversuchen, nur Anzeige +
  Systembenachrichtigung.
- Sitzungs-Standort zeigt die rohe IP-Adresse, keine Geolocation
  (Stadt/Land) – kein Geolocation-Dienst angebunden, bewusste
  Vereinfachung statt erfundener Daten.
