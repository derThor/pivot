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

## Nachtrag 2026-08-21: Drei getrennte Zustände statt einer verwechselten Aktion

Nutzer-Bugreport: "ich lösche einen nutzer und der wird nur deaktiviert?!
ist dennoch in der liste. das versteht keiner." – vorher riefen sowohl der
"Löschen"-Button in der Benutzerliste (`user-row-actions.tsx`) als auch der
"Sperren"-Button auf der Bearbeiten-Seite dieselbe `UsersService.remove()`
(nur `isActive:false`) auf, während "Endgültig löschen" auf derselben
Bearbeiten-Seite direkt `anonymize()` auslöste – zwei Seiten benutzten
unterschiedliche Wörter für dieselbe Aktion, eine dritte sprang eine ganze
Stufe. Jetzt drei klar getrennte, konsistent benannte Zustände:

1. **Gesperrt** (`isActive:false` + `deactivatedAt`, unverändert
   `remove()`/`DELETE /users/:id`) – reversibel, bleibt in der
   Benutzerliste, "Entsperren" jederzeit möglich.
2. **Gelöscht** (neues Feld `User.deletedAt`, neue Methode
   `UsersService.delete()` / `POST /users/:id/delete`) – verschwindet aus
   `findAll()` (Benutzerliste), taucht stattdessen unter Datenschutz →
   Tab "Nutzer" auf (vorher zeigte dieser Tab nur *überfällige*
   deaktivierte Konten – "und dann taucht er nichtmal in datenschutz im
   reiter gelöschte nutzer auf" – jetzt alle noch nicht anonymisierten
   gelöschten Konten sofort, überfällige zusätzlich mit "überfällig"-Badge).
   `UsersService.findDeleted()` löst das ab, was vorher
   `findDeactivatedOlderThan()` hieß.
3. **Anonymisiert** (`anonymizedAt`, `anonymize()`) – nur noch von
   Datenschutz → "Nutzer" aus auslösbar, nicht mehr direkt von der
   Bearbeiten-Seite. `findAll()` blendet anonymisierte Konten jetzt
   standardmäßig aus (auch das war ein Bugreport: "anonymisierte nutzer
   sollen nicht mehr unter benutzer unter alle aufgeführt werden") – neuer
   Tab/Pill "Anonymisiert" auf der Benutzer-Seite (`QueryUserDto.anonymized`)
   macht sie weiterhin auffindbar, ohne die Standardliste zu verschmutzen.
   `anonymize()` löscht zusätzlich `street`/`postalCode`/`city` (fehlte
   vorher – Lücke bei der letzten Adressfelder-Erweiterung).

## Nachtrag 2026-08-21 (2): Wiederherstellen + Bestätigung vor Anonymisieren

Zwei direkte Folge-Nachträge zum obigen Drei-Zustände-Umbau:

- **Wiederherstellen** ("auf gelöscht gesetzte nutzer sollen
  wiederhergestellt werden können, solange sie nicht anonymisiert
  wurden... mit einem icon"): neue `UsersService.restore()` /
  `POST /users/:id/restore` (`deletedAt: null, isActive: true`, wirft
  `BadRequestException` wenn nicht gelöscht oder bereits anonymisiert).
  Neue geteilte Komponente `user-restore-button.tsx` (RotateCcw-Icon,
  kein Bestätigungsdialog nötig – die Aktion selbst ist reversibel) an
  **beiden** Stellen, an denen gelöschte Nutzer auftauchen: Benutzer-Seite
  (neuer Tab/Pill "Gelöscht", `QueryUserDto.deleted`, analog zu
  `anonymized`) und Datenschutz → Tab "Benutzer" (dort umbenannt von
  "Nutzer" auf Nutzervorgabe).
- **Bestätigungsdialog vor Anonymisieren**: der "Anonymisieren"-Button im
  Datenschutz-Tab feuerte bisher ohne Rückfrage (Nutzervorgabe: "ein
  hinweis popup, wenn man anonymisiert, das es endgültig ist") – jetzt
  hinter `ConfirmDeleteDialog` mit explizitem Endgültig-Hinweis, gleiches
  Muster wie überall sonst in der App.
- **Trash-Icon in der Benutzerliste rief fälschlich `remove()` (Sperren)
  statt der neuen `delete()` auf** – eigener Bugreport mitten im obigen
  Umbau ("ich rede von dem mülleimer symbol in der auflistung"): der
  `user-row-actions.tsx`-Löschen-Button war beim ersten Durchgang
  übersehen worden, zeigte weiterhin "deaktiviert" und tat auch das.
  Korrigiert auf `POST /users/:id/delete`.

## Stolpersteine / Besonderheiten

- **Dev-Server lief wiederholt als `dist/main`-Prod-Build statt im
  `nest start --watch`-Modus** – Backend-Änderungen kamen dadurch beim
  Testen mehrfach nicht an (u.a. Grund für die "geht nicht"-Bugreports
  während dieses Umbaus). Ursache nicht abschließend geklärt (irgendetwas
  startet den Prozess immer wieder im Prod-Modus); falls Backend-Änderungen
  an dieser Seite nicht ankommen, zuerst `Get-NetTCPConnection -LocalPort
  3001` prüfen, ob der Prozess wirklich `nest start --watch` ist.
- Ansonsten deckungsgleiches Muster wie bei den bisherigen Bearbeiten-
  /Löschen-Features (Content, Medien).

## Relevante Dateien

- `apps/api/src/users/dto/update-user.dto.ts`
- `apps/api/src/users/users.service.ts`
- `apps/api/src/users/users.controller.ts`
- `apps/web/src/components/edit-user-dialog.tsx`
- `apps/web/src/components/user-row-actions.tsx`
- `apps/web/src/app/api/users/[id]/route.ts`
- `apps/web/src/app/dashboard/users/page.tsx`
- `apps/web/src/app/api/users/[id]/delete/route.ts` (neu, 2026-08-21)
- `apps/web/src/components/{user-edit-view,users-table,users-filter-bar}.tsx`,
  `packages/database/prisma/schema.prisma` (`User.deletedAt`),
  `apps/web/src/components/privacy-view.tsx` (Tab "Nutzer") – siehe
  Nachtrag oben

## Offene Punkte

- Keine Schutzmaßnahme gegen das Löschen des letzten verbleibenden
  `ADMIN`-Accounts (nur Selbstlöschung ist blockiert – ein anderer Admin
  könnte trotzdem den letzten verbleibenden Admin löschen, falls es mehrere
  gäbe und alle bis auf einen entfernt würden). Bewusst nicht umgesetzt,
  da nicht explizit gefordert und die Selbstlöschsperre den
  Alltagsfall bereits abdeckt.
