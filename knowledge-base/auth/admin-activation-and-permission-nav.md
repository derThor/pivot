# Admin-Freischaltung für Registrierungen + rollenabhängige Navigation

**Datum:** 2026-08-03
**Betroffene Bereiche:** apps/api (`src/auth`, `src/settings`,
`packages/database/prisma/schema.prisma`), apps/web
(`src/components/settings-form.tsx`, `register-form.tsx`,
`app-sidebar.tsx`, `src/app/api/auth/register/route.ts`)

## Was wurde gebaut

- **Neue Einstellung `requireAdminActivation`** (`AppSettings`, Default
  `false`) unter [Settings](./settings-and-password-policy.md) im Tab
  "Zugriff & Funktionen": ist sie aktiv, werden neu registrierte Benutzer
  mit `isActive: false` angelegt statt sofort aktiv zu sein. Ist sie
  deaktiviert (Default), bleibt das bisherige Verhalten unverändert –
  sofort aktiv.
- `AuthService.register()`: verzweigt danach. Bei `isActive: false`
  **kein** `issueTokens()`-Aufruf mehr (vorher wurden bei jeder
  Registrierung sofort Tokens ausgestellt, unabhängig vom Status) –
  stattdessen `{ pendingActivation: true, message: '...' }`. `login()`
  blockierte inaktive Konten bereits vorher (`if (!user.isActive) throw
  UnauthorizedException`), das war also schon vorhanden und musste nicht
  geändert werden.
- Freischaltung selbst braucht **keinen neuen Endpoint**: Admins nutzen
  den bereits bestehenden Aktiv/Deaktiviert-Schalter in der
  Benutzerverwaltung (`PATCH /users/:id`, siehe
  [user-edit-delete.md](../frontend/user-edit-delete.md)) – ein
  wartender Account ist technisch identisch zu einem deaktivierten.
- Frontend: `RegisterForm` zeigt bei `pendingActivation` eine eigene
  Erfolgsmeldung ("wartet auf Freischaltung...") mit Link zu `/login`
  statt des bisherigen Auto-Redirects zu `/dashboard`; die
  BFF-Route `POST /api/auth/register` setzt in diesem Fall keine
  Auth-Cookies (keine Tokens in der Backend-Antwort vorhanden).
- **Rollenabhängige Navigation**: `AppSidebar` blendet Nav-Punkte, deren
  Bereich der User laut Rechten gar nicht öffnen kann, jetzt aus
  ("Benutzer & Rollen" → `users:manage`, "Rollen & Rechte" →
  `roles:manage`, "Einstellungen" → `settings:manage`). "Inhalte",
  "Medien", "Kategorien & Tags" bleiben für alle sichtbar, da die
  jeweiligen `GET`-Endpoints ohne `@RequirePermission` für jeden
  authentifizierten User offen sind (siehe
  [content-versioning.md](../content/content-versioning.md)) – dort gibt
  es nichts zu verbergen.
- Dafür liefert `GET /auth/me` jetzt zusätzlich `permissions: string[]`
  (aus dem bereits im JWT enthaltenen Payload gemerged, kein zusätzlicher
  DB-Call) – vorher enthielt die Antwort nur die aus `UsersService`
  geladenen Profildaten.

## Warum diese Lösung

- **Bestehenden Aktiv-Status wiederverwenden statt eines neuen
  "pending"-Felds**: `User.isActive` deckt die Anforderung exakt ab
  (`login()` blockiert bereits inaktive Accounts), ein separates
  Enum/Flag hätte nur Redundanz erzeugt, ohne neue Information zu
  liefern.
- **`permissions` aus dem JWT mergen statt neu aus der DB laden**: Die
  Rechte sind bei jeder Token-Ausstellung bereits frisch geladen
  (`issueTokens()`), ein zusätzlicher Prisma-Join in `me()` wäre
  redundant und würde die Rechte-Quelle unnötig verdoppeln.
- **Content/Medien/Kategorien bleiben immer sichtbar**: Die Navigation
  soll nur Bereiche verbergen, die tatsächlich zu einer
  "Keine Berechtigung"-Sackgasse führen – für lesbare Bereiche gibt es
  diese Sackgasse nicht, sie auszublenden wäre irreführend (der User
  *kann* dort etwas sehen, auch ohne Schreibrechte).

## Stolpersteine / Besonderheiten

- Base UI `Select`/`SelectValue` löst den angezeigten Wert nur auf, wenn
  der `Select`-Root ein `items`-Prop (Wert→Label-Mapping) bekommt – ohne
  das fällt die Anzeige auf `String(value)` zurück (rohe ID/Enum-Wert
  statt Label). Kein Teil dieses Features, aber im selben Zeitraum als
  Bug in den bestehenden Rollen-/Content-Type-/Status-Dropdowns gefunden
  und behoben (betraf `user-role-select.tsx`, `create-user-dialog.tsx`,
  `edit-user-dialog.tsx`, `content-editor-form.tsx`).
- `CurrentUser.permissions` ist bewusst optional (`permissions?:
  string[]`), da derselbe Typ auch für Einträge der Benutzerliste
  (`getUsers()`) verwendet wird – dort liefert die API keine Rechte pro
  Zeile (wäre ein Join pro Listen-Eintrag, für eine reine Übersicht nicht
  gerechtfertigt).

## Relevante Dateien

- `packages/database/prisma/schema.prisma` (`AppSettings.requireAdminActivation`)
- `apps/api/src/auth/auth.service.ts` (`register`), `auth.controller.ts` (`me`)
- `apps/api/src/settings/settings.service.ts`, `dto/update-settings.dto.ts`
- `apps/web/src/components/settings-form.tsx`, `register-form.tsx`,
  `app-sidebar.tsx`
- `apps/web/src/app/api/auth/register/route.ts`
- `apps/web/src/lib/api-server.ts` (`CurrentUser.permissions`,
  `AppSettings.requireAdminActivation`)
- `apps/web/src/components/ui/password-input.tsx` (Passwort
  anzeigen/verbergen-Toggle, im selben Zeitraum ergänzt, in allen
  Passwortfeldern eingesetzt)
- `apps/api/test/auth-security.e2e-spec.ts` (`Admin-Freischaltung`)

## Offene Punkte

- Keine E-Mail-Benachrichtigung an Admins, wenn ein Konto auf
  Freischaltung wartet – Admins müssen die Benutzerliste selbst prüfen.
- Kein visuelles "wartet auf Freischaltung"-Badge in der
  Benutzerverwaltung, das sich von einem regulär deaktivierten Konto
  unterscheidet (beide zeigen aktuell "Deaktiviert").
