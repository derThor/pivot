# Benutzer vollständig bearbeiten und löschen

> **Update 2026-08-03:** `name` wurde zu `firstName`/`lastName` gesplittet,
> und ob die E-Mail-Adresse geändert werden darf, ist jetzt eine globale
> Einstellung (`allowEmailChange`), nicht mehr immer erlaubt. Details:
> [rbac-rework.md](./rbac-rework.md),
> [settings-and-password-policy.md](./settings-and-password-policy.md).

**Datum:** 2026-08-02
**Betroffene Bereiche:** apps/api (`src/users`), apps/web
(`src/components/edit-user-dialog.tsx`,
`src/components/user-row-actions.tsx`)

## Was wurde gebaut

- Backend: `UpdateUserDto` um `email` (`@IsEmail`) ergänzt – vorher konnten
  nur `name`, `role`, `isActive` per `PATCH /users/:id` geändert werden,
  obwohl der Roadmap-Punkt explizit "Name/E-Mail/Aktiv-Status" nannte.
  `UsersService.update()` prüft bei geänderter E-Mail vorab auf Konflikt
  mit einem anderen Benutzer (`ConflictException`, gleiches Muster wie bei
  Categories/Tags).
- Backend: `UsersService.remove()` bekommt einen zweiten Parameter
  `currentUserId` – Löschen des eigenen Accounts wird mit
  `BadRequestException` abgelehnt. `UsersController.remove()` liest die
  aufrufende User-ID aus `@CurrentUser()`.
- Frontend: `EditUserDialog` (Name/E-Mail/Status, Status als Select
  "Aktiv"/"Deaktiviert" statt eines eigenen Switch-Bauteils, da kein
  Switch-Component im Projekt existiert und ein Select konsistent zu den
  übrigen Formularen ist) + `UserRowActions` (Bearbeiten-Icon immer
  sichtbar, Löschen-Icon nur für fremde Accounts – `isSelf`-Check
  gegen den eingeloggten User).
- Neuer `DELETE`-Handler in `app/api/users/[id]/route.ts` (der `PATCH`-
  Handler existierte bereits aus der ursprünglichen Rollen-Änderung).

## Warum diese Lösung

- **Selbstlöschschutz sowohl im Backend als auch in der UI**: Die
  Backend-Prüfung ist die eigentliche Absicherung (verhindert
  Selbstlöschung z.B. auch über einen direkten API-Call); die UI blendet
  den Löschen-Button für die eigene Zeile zusätzlich aus, damit der Fehler
  gar nicht erst provoziert wird – beides zusammen statt nur einer Seite.
- **Status als Select statt Switch/Checkbox**: Es gibt aktuell keine
  shadcn-`Switch`-Komponente im Projekt; ein neues UI-Element extra für
  dieses eine Feld einzuführen wäre unverhältnismäßig, ein Select passt
  sich nahtlos in bestehende Formulare ein (gleiches Pattern wie
  Rollen-Auswahl, Content-Status).
- **E-Mail-Konfliktprüfung vor dem Update statt auf den rohen
  Prisma-Unique-Constraint-Fehler zu vertrauen**: konsistente,
  verständliche Fehlermeldung statt eines generischen 500ers/Prisma-Fehlers
  (gleiches Muster wie in `categories.service.ts`/`tags.service.ts`).

## Stolpersteine / Besonderheiten

- Keine – deckungsgleiches Muster wie bei den bisherigen Bearbeiten-
  /Löschen-Features (Content, Medien).

## Relevante Dateien

- `apps/api/src/users/dto/update-user.dto.ts`
- `apps/api/src/users/users.service.ts`
- `apps/api/src/users/users.controller.ts`
- `apps/web/src/components/edit-user-dialog.tsx`
- `apps/web/src/components/user-row-actions.tsx`
- `apps/web/src/app/api/users/[id]/route.ts`
- `apps/web/src/app/dashboard/users/page.tsx`

## Offene Punkte

- Keine Schutzmaßnahme gegen das Löschen des letzten verbleibenden
  `ADMIN`-Accounts (nur Selbstlöschung ist blockiert – ein anderer Admin
  könnte trotzdem den letzten verbleibenden Admin löschen, falls es mehrere
  gäbe und alle bis auf einen entfernt würden). Bewusst nicht umgesetzt,
  da nicht explizit gefordert und die Selbstlöschsperre den
  Alltagsfall bereits abdeckt.
