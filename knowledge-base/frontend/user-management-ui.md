# Benutzerverwaltung-UI: Liste, Anlegen, Rollen ändern

> **Update 2026-08-03:** Rollen sind seit dem RBAC-Umbau keine feste
> 4-Werte-Enum mehr, sondern dynamisch aus `GET /roles` geladen; `name`
> wurde zu `firstName`/`lastName` gesplittet. Details:
> [rbac-rework.md](./rbac-rework.md). Die Grundstruktur dieser Seite
> (Tabelle, `UserRoleSelect`, `CreateUserDialog`) ist unverändert, nur die
> Datenquelle für Rollen/Namen hat sich geändert.

**Datum:** 2026-08-02
**Betroffene Bereiche:** apps/web (`src/app/dashboard/users`,
`src/components/create-user-dialog.tsx`,
`src/components/user-role-select.tsx`, `src/app/api/users/*`)

## Was wurde gebaut

- `/dashboard/users`: Tabelle aller Benutzer (Name, E-Mail, Rolle, Status)
  über `getUsers()` (`GET /users`, bereits vorhanden, `@Roles(Role.ADMIN)`).
- `CreateUserDialog`: Dialog mit react-hook-form + zod (Name, E-Mail,
  Passwort, Rolle), POST über neuen Route Handler `POST /api/users`.
- `UserRoleSelect`: inline `Select` pro Tabellenzeile, ändert die Rolle
  direkt über `PATCH /api/users/[id]` und aktualisiert die Seite
  (`router.refresh()`).
- Beide neuen Route Handler (`src/app/api/users/route.ts`,
  `src/app/api/users/[id]/route.ts`) sind reine BFF-Proxys nach dem
  bekannten Muster aus `/api/content` (Access-Token aus dem httpOnly-Cookie
  lesen, als `Authorization`-Header weiterreichen).
- Kein Backend-Change nötig – `GET/POST /users` und `PATCH /users/:id`
  existierten bereits (siehe
  [auth-jwt-refresh-rotation.md](../auth/auth-jwt-refresh-rotation.md), RBAC-Teil).

## Warum diese Lösung

- Rollenänderung direkt inline per Select statt eigener Detail-/Edit-Seite:
  einzige editierbare Eigenschaft im Scope dieses Features ist die Rolle
  (Roadmap: "Liste, Anlegen, Rollen ändern"), ein Select spart eine
  Navigationsebene.
- `getUsers()` liefert bei fehlender Admin-Berechtigung `null` (durch den
  bestehenden `apiFetch`-Helper, der bei jedem Non-2xx `null` statt zu
  werfen zurückgibt) – die Seite zeigt dafür bewusst "Keine Berechtigung"
  statt eines Runtime-Fehlers. Es gibt aktuell aber **keine**
  UI-seitige Rollenprüfung, die den Sidebar-Link selbst ausblendet – jeder
  eingeloggte User sieht "Benutzer & Rollen" in der Navigation, bekommt
  aber beim Öffnen nur die leere Berechtigungsmeldung. Bewusst nicht weiter
  gehärtet, da RBAC im Backend ohnehin die eigentliche Absicherung ist.

## Stolpersteine / Besonderheiten

- Keine – deckungsgleich mit dem bereits etablierten BFF-Route-Handler-
  Muster aus [content-editor-dynamic-forms.md](../content/content-editor-dynamic-forms.md).

## Relevante Dateien

- `apps/web/src/app/dashboard/users/page.tsx`
- `apps/web/src/components/create-user-dialog.tsx`
- `apps/web/src/components/user-role-select.tsx`
- `apps/web/src/app/api/users/route.ts`
- `apps/web/src/app/api/users/[id]/route.ts`

## Offene Punkte

- ~~Kein Deaktivieren/Löschen von Benutzern in der UI~~ – inzwischen
  erledigt, siehe [user-edit-delete.md](./user-edit-delete.md).
- ~~Navigation blendet "Benutzer & Rollen" nicht rollenabhängig aus (siehe
  oben)~~ – inzwischen erledigt, siehe
  [admin-activation-and-permission-nav.md](../auth/admin-activation-and-permission-nav.md).
