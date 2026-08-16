# Von 4 festen Rollen zu granularem, admin-verwaltbarem RBAC

**Datum:** 2026-08-03, erweitert 2026-08-16
**Betroffene Bereiche:** apps/api (`src/roles`, `src/auth`, alle Controller),
apps/web (`src/app/dashboard/roles`, diverse Komponenten),
packages/database (Schema, Seed)

## Update 2026-08-16: Feinere Rechte-Granularität + 7 Beispielrollen

Die ursprünglichen 13 Rechte (u.a. `users:manage`, `roles:manage`,
`settings:manage` als grobe Bundle-Rechte) wurden auf 40 feingranulare
Rechte aufgesplittet, damit Rollen wie "darf planen, aber nicht selbst
veröffentlichen" oder "darf Webhooks nicht anfassen, aber alles andere in
den Einstellungen" abbildbar sind:

- **Neue Ressourcen**: `navigation` (read/update/reorder), `module-types`
  (nur read – siehe bestehende Seed-only-Einschränkung),
  `gallery`/`faq`/`preview-links`/`webhooks` (vorher alle unter
  `settings:manage` bzw. `content:read` mitgelaufen).
- **Aufgesplittete Bundle-Rechte**: `users:manage` → `read`/`invite`/
  `update`/`deactivate`; `roles:manage` → `read`/`create`/`update` (kein
  eigenes `delete` – Löschen läuft über `roles:update`, analog zu
  `users:update`, das ebenfalls kein eigenes Delete hat);
  `settings:manage` → `read`/`update`.
- **Neue Aktionen auf bestehenden Ressourcen**: `content:publish` und
  `content:schedule` zusätzlich zu `create`/`update` – ermöglicht z.B. die
  Rolle "Redakteur" (darf Inhalte planen, aber erst ein Chefredakteur
  veröffentlicht sie final).
- **Kategorisierung** (`PermissionCategory`: `core`/`extensions`/
  `administration`) rein für die Rollen-UI-Gruppierung, in
  `permissions.catalog.ts` (`PERMISSION_CATEGORY_BY_RESOURCE`) und von
  `RolesService.getPermissionsCatalog()` mit ausgeliefert. `GET /permissions`
  liefert jetzt `{resource, action, key, category}[]` statt `string[]`.
- **7 Beispielrollen** statt 4 (Nutzervorgabe, Bildvorlage): Administrator,
  Chefredaktion, Redakteur, Autor, Medienpflege, Formular-Manager (Platzhalter
  für ein noch nicht existierendes Formular-Modul), Gast/Praktikum. Alte
  Rollen wurden per `id`-Update umbenannt statt neu angelegt (`ROLE_RENAMES`
  in `seed.ts`), damit bereits zugewiesene `User.roleId` erhalten bleiben.

**Wie die neuen Ressourcen durchgesetzt werden:**

- `navigation`, `webhooks`: eigene Controller, 1:1 wie die bestehenden
  Ressourcen – `@RequirePermission('webhooks:create')` etc. direkt am
  Handler statt am Controller (vorher ein `settings:manage` für die ganze
  Klasse).
- `content:publish`/`content:schedule`: es gibt keine eigenen
  Publish/Schedule-Endpoints, `status` steckt im generischen Create/Update-
  DTO. Deshalb manuelle Prüfung in `ContentController.assertStatusPermission()`
  (wirft `ForbiddenException`, wenn `dto.status` auf `PUBLISHED`/`SCHEDULED`
  wechselt und das jeweilige Recht fehlt) statt `@RequirePermission`.
- `gallery`/`faq`: `GlobalModule` ist generisch über `moduleTypeId` typisiert
  (ein Modul-Typ kann theoretisch alles sein), es gibt also keine 1:1-Route
  pro Ressource. Da `ModuleType.slug` bereits `"gallery"`/`"faq"` heißt
  (Zufall? Nein – deckt sich exakt mit den Katalog-Ressourcen), löst
  `GlobalModulesService.resolveResource()`/`resolveResourceForModule()` den
  Modul-Typ auf und `GlobalModulesController` prüft danach manuell
  `user.permissions.includes(\`${resource}:${action}\`)`. Alle anderen
  Modul-Typen (Inline-Bausteine, nie als globales Modul über die Dashboard-UI
  erstellbar) fallen auf `settings:update` zurück – nie `settings:create`/
  `-delete`, die es im Katalog nicht gibt (würde sonst niemand je besitzen
  können).
- `preview-links`: vorher unter `content:read` mitgelaufen (bewusst zu grob).
  Katalog hat nur `read`/`create`/`revoke` (kein `update`) – das PATCH zum
  Verlängern der Gültigkeit (`updatePreviewLink`, ändert nur `expiresInHours`)
  läuft fachlich unter `preview-links:create` (gleiche Fähigkeitsstufe wie
  einen neuen Link auszustellen).

**Manuelle Prüfung statt `@RequirePermission` – wann welches Muster:**
`PermissionsGuard` kennt nur ein statisches Recht pro Route
(`SetMetadata`). Überall dort, wo das nötige Recht erst zur Laufzeit aus dem
Request-Body/einer referenzierten Entity hervorgeht (Content-Status,
Modul-Typ), wird stattdessen im Controller `user.permissions.includes(...)`
geprüft und bei Bedarf `ForbiddenException` geworfen – Fortführung des
schon vorher bestehenden Musters in `ContentController.unlock()`.

**Manuell verifiziert** (Login als Admin + als temporärer Testnutzer mit
eingeschränkter Rolle über die laufende Dev-API): `Redakteur` kann Content
mit `status=SCHEDULED` anlegen (201), aber nicht mit `status=PUBLISHED`
(403); eine Rolle ohne `gallery:create` bekommt beim Anlegen eines globalen
Moduls vom Typ "Bildergalerie" ein `403 Fehlende Berechtigung: gallery:create`,
ein Admin kann es.

### Nachtrag: zwei Regressionen durch den Rechte-Umbau selbst behoben

**1. Frontend/Backend prüften nach dem Seed-Update noch auf inzwischen
gelöschte Permission-Strings.** `packages/database/prisma/seed.ts` löscht
die alten Bundle-Rechte (`OBSOLETE_PERMISSIONS`) nach dem Seed komplett aus
der DB – aber mehrere Stellen prüften weiterhin hart-codiert auf genau diese
Strings, die dadurch für *jede* Rolle inkl. Administrator nicht mehr
erreichbar waren. Sichtbares Symptom: Admin sah "Rollen & Rechte",
"Einstellungen", "Webhooks" und "Menüs" nicht mehr in der Sidebar/im
Header-Dropdown. Betroffen und gefixt:
- `apps/web/src/components/app-sidebar.tsx` (`navGroups`-Permission-Felder,
  `canManageSettings`) – auch von `admin-menu.tsx`/`dashboard-breadcrumbs.tsx`
  mitgenutzt, da sie dieselbe `navGroups`-Datenquelle teilen.
- `apps/web/src/components/command-palette.tsx` (`canManageSettings`)
- `apps/web/src/app/dashboard/layout.tsx` (`canViewSystemMessages`)
- `apps/api/src/search/search.service.ts` (Sichtbarkeit von Nutzer-/Rollen-
  Treffern in der globalen Suche)

  Mapping: `settings:manage`→`settings:read` (reine Sichtbarkeit von
  Nav-Punkten/Links), `users:manage`→`users:read`, `roles:manage`→
  `roles:read`, Navigation/Webhooks-Nav-Items→`navigation:read`/
  `webhooks:read`. **Lehre für künftige Rechte-Umbenennungen**: nach einem
  `grep` auf den alten Permission-String suchen (nicht nur in den
  Controllern, die den Fehler ursprünglich motiviert haben) – Sidebar/
  Command-Palette/Suche liegen leicht außerhalb des ersten Blickfelds, weil
  sie keine Compile-Zeit-Kopplung zum Backend-Katalog haben (reine Strings).

**2. `DELETE /users/:id` war ein Hard-Delete** (`prisma.user.delete`) und
schlug mit 500 fehl, sobald der Nutzer irgendeinen `Content` verfasst hatte
(`contents_authorId_fkey`, keine Cascade/SetNull) – unabhängig vom
Rechte-Umbau, aber durch die Umbenennung zu `users:deactivate` semantisch
zum Versprechen geworden. Gefixt: `UsersService.remove()` setzt jetzt
`isActive: false` (Feld existierte bereits, wird schon beim Login geprüft)
statt hart zu löschen, und widerruft in derselben Transaktion alle
Refresh-Tokens des Nutzers. Dabei auffällig: `AuthService.refresh()`
prüfte `isActive` bisher gar nicht – ein deaktivierter Nutzer mit noch
gültigem Refresh-Token hätte sich beliebig lange neue Access-Tokens holen
können (unabhängig davon, ob die Deaktivierung über `DELETE` oder den
`isActive`-Toggle im Bearbeiten-Dialog kam). Jetzt auch dort geprüft.
Frontend (`user-row-actions.tsx`, `users-table.tsx`) von "löschen" auf
"deaktivieren" umbenannt (Button, Bestätigungsdialog, Toast) – der Account
bleibt über den Bearbeiten-Dialog (`isActive`-Switch) jederzeit
reaktivierbar. `SelectionToolbar` hat dafür optionale
`actionLabel`/`confirmTitle`/`confirmDescription`-Props bekommen (Default
unverändert "löschen", nur die Nutzer-Tabelle überschreibt sie).

### Update 2026-08-16 (Teil 1b): Beispielrollen auf 3 reduziert

Nutzervorgabe (noch am selben Tag): Chefredaktion, Autor, Medienpflege und
Formular-Manager wieder entfernt – übrig bleiben Administrator, Redakteur,
Gast. Aus `ROLES` in `seed.ts` gestrichen; der Seed legt entfernte Rollen
nicht automatisch an (`upsert` nur für vorhandene Einträge), deshalb wurden
die vier DB-Zeilen direkt per SQL gelöscht (`DELETE FROM roles WHERE
name IN (...)`) statt über die API – `RolesController` blockiert
`DELETE` für `isSystem`-Rollen, und `UpdateRoleDto` erlaubt kein Umflaggen
von `isSystem`. `RolePermission` cascadet automatisch
(`onDelete: Cascade` in `schema.prisma`). Ein alter Testnutzer mit
`Chefredaktion`-Rolle wurde vorher per `PATCH /users/:id` auf `Gast`
umgehängt, um die FK-Constraint (`User.roleId`) nicht zu verletzen.

### Update 2026-08-16 (Teil 1c): Manager-Rolle + feste Anzeige-Reihenfolge

- **`Role.sortOrder Int @default(0)`** neu im Schema (gleiches Muster wie
  `NavigationItem.sortOrder`) – die Rollen-Liste sortiert jetzt danach statt
  alphabetisch nach `name` (`RolesService.findAll`/`findPage`). Nutzervorgabe:
  Administrator → Manager → Redakteur → Gast, nicht alphabetisch.
- **Neue Rolle "Manager"**, direkt unter Administrator: alle Rechte außer
  `roles:create`/`roles:update` und `settings:update` (lesend darf sie
  beides weiterhin, `roles:read`/`settings:read` sind Teil der gefilterten
  `PERMISSIONS`-Liste) – operative Vollmacht fürs Tagesgeschäft, ohne die
  Rechte-Architektur selbst verändern oder globale Systemeinstellungen
  anfassen zu können.
- **Migration**: `prisma db push` statt `migrate dev` (kein Migrations-
  Verlauf für dieses Dev-Projekt gepflegt). Die Windows-EPERM-Falle bei
  `prisma generate` (siehe "Stolpersteine" weiter unten) trat erneut auf,
  gleicher Fix: laufenden `node ... apps\api\dist\main`-Prozess (nicht den
  `nest.js --watch`-Wrapper selbst) über `Get-CimInstance Win32_Process`
  identifizieren und gezielt per PID `Stop-Process -Force` beenden – der
  Watcher startet ihn danach automatisch mit dem neu generierten Client neu.
- **Nutzer-Popup**: "Nutzer {n}" in der Umfang-Box ist jetzt klickbar und
  öffnet einen Dialog mit den zugewiesenen Nutzern (Name + E-Mail). Dafür
  neu: `roleId`-Filter auf `GET /users` (`QueryUserDto`/`UsersService.findAll`)
  sowie ein bisher fehlender `GET`-Handler in
  `apps/web/src/app/api/users/route.ts` (die Route hatte bis dahin nur
  `POST` für das Anlegen, kein Query-Proxy für Client-seitige Fetches).

### Update 2026-08-16 (Teil 1d): Rechte-Eskalation über Rollen-Zuweisung geschlossen

Gefunden auf Nachfrage des Nutzers ("kann der Manager sich oder anderen
Nutzern die Admin-Rolle geben?"): `PATCH/POST /users` prüfte beim Setzen
von `roleId` nur, ob die Rolle existiert – jeder mit `users:update`/
`users:invite` (z.B. Manager) konnte sich oder andere zu Administrator
machen. Gefixt: `UsersService.assertMayAssignRole()` (privat, genutzt von
`create()` und `update()`) wirft `ForbiddenException`, wenn die
Ziel-Rolle `Administrator` heißt und der ausführende Nutzer nicht selbst
Administrator ist (`actingUser.roleName` aus dem JWT-Payload, dafür
`@CurrentUser()` neu an `UsersController.create()`/`update()`). Manuell
verifiziert: Manager-Testnutzer bekommt 403 beim Selbst-Hochstufen, Admin
kann weiterhin jeden auf Administrator setzen.

### Update 2026-08-16 (Teil 2): Visuelles Redesign der Rollen-Seite

`/dashboard/roles` von Tabelle + Anlegen/Bearbeiten-Dialog auf eine
Split-View-Seite umgestellt, nach vom Nutzer vorgelegter Bildvorlage.
Mehrsitzungs-Vorhaben, vollständiger Plan/Fortschritt in
[docs/ROADMAP.md](../../docs/ROADMAP.md) Abschnitt 2b.13 – dort auch der
aktuelle Stand ("noch offen"), hier nur die Design-Entscheidungen.

- **Neue Komponente `roles-explorer.tsx`** ersetzt `roles-table.tsx` +
  `role-row-actions.tsx` (gelöscht). URL-Pattern `?role=<id>` 1:1 nach dem
  Vorbild von `navigation-explorer.tsx` (`?menu=<id>`) – akzeptiert
  zusätzlich `?highlight=`, weil die globale Suche (`lib/search.ts
  searchResultHref`) dieses generische Query-Param für alle Listen-Seiten
  setzt.
- **Ein gemeinsames Formular statt getrennter Dialoge**: Beschreibung,
  "Zugriff auf das Backend"-Switch und alle Rechte-Checkboxen teilen sich
  einen Dirty-State und werden zusammen per PATCH gespeichert
  ("Zurücksetzen"/"Rechte speichern"). Der Rollenname ist bewusst reine
  Anzeige (kein Inline-Rename in der neuen Ansicht) – Anlegen läuft
  weiterhin über den bestehenden `RoleFormDialog`-Modal-Dialog, der dafür
  unverändert blieb (nur seine Label-Konstanten wurden nach
  `lib/permission-labels.ts` ausgelagert).
- **`lib/permission-labels.ts`** (neu): zentrale Resource-/Action-/
  Category-Labels + Icons, vorher in `role-form-dialog.tsx` dupliziert –
  jetzt von `role-form-dialog.tsx` UND `roles-explorer.tsx` importiert.
- **Administrator-Rolle clientseitig schreibgeschützt** (Lock-Icon,
  "Geschützt"-Badge statt "bearbeitbar", alle Inputs disabled) – reiner
  UX-Schutz vor versehentlicher Selbstaussperrung, hardcodiert auf
  `role.name === "Administrator"` (nicht auf `isSystem`, da alle 7
  Beispielrollen `isSystem: true` sind, aber nur Admin in der Bildvorlage
  das Schloss-Icon zeigt). Das Backend erlaubt technisch weiterhin, die
  Rechte der Admin-Rolle per direktem API-Call zu ändern – kein neues
  Risiko gegenüber vorher, nur eine zusätzliche UI-Hürde.
- **Bewusst nicht 1:1 nach Bildvorlage übernommen**: Die Vorlage zeigt 71
  Rechte über Ressourcen, die teils noch gar nicht existieren (Formulare,
  Websites/Multi-Site, Systemnachrichten) oder zusätzliche, backend-seitig
  nicht durchgesetzte Aktionen (Kategorien "Umsortieren", Tags
  "Zusammenführen", Medien "Tags zuweisen", Webhooks "Logs
  einsehen"/"Manuell auslösen", Einstellungen "API-Schlüssel verwalten").
  Nutzervorgabe (2026-08-16): "Formular und Systembenachrichtigungen nicht
  beachten, das kommt später" – die neue Seite zeigt nur die 13 real
  existierenden Ressourcen mit den tatsächlich durchgesetzten 46 Rechten.
  Erfundene Checkboxen ohne echte Backend-Prüfung dahinter hätten dem in
  diesem Dokument selbst festgehaltenen Prinzip widersprochen ("Der feste
  Katalog hält Rechte und tatsächlich durchgesetzte Autorisierung
  synchron").
- **Nicht visuell verifiziert**: Kein Playwright/Chromium in diesem
  Projekt installiert, daher nur per SSR-HTML-Inspektion über `curl`
  geprüft (Seite lädt fehlerfrei, erwartete Texte/Karten vorhanden,
  Admin-Rolle korrekt gesperrt, Rollenwechsel per URL-Param funktioniert).
  Kein echter Screenshot – visueller Feinschliff (Abstände, Farben,
  exakte Icon-Wahl) gegen die Bildvorlage steht noch aus.

## Was wurde gebaut (2026-08-03, ursprünglicher Umbau)

- Das bisherige `Role`-Enum (`ADMIN | EDITOR | AUTHOR | VIEWER`) auf `User`
  wurde durch drei neue Tabellen ersetzt: `Role` (id, name, description,
  `isSystem`, `isDefault`), `Permission` (resource, action – fester,
  code-definierter Katalog wie `content:create`, `content:read`,
  `users:manage`) und `RolePermission` als n:m-Verknüpfung. `User.role`
  wurde zu `User.roleId` (Pflicht-FK).
- Neues Backend-Modul `src/roles`: `GET/POST/PATCH/DELETE /roles` (volle
  CRUD für Rollen inkl. Rechte-Zuweisung), `GET /permissions` (liefert den
  festen Katalog für die UI). Rollen mit `isSystem=true` oder zugewiesenen
  Usern können nicht gelöscht werden (gleiches Schutzmuster wie der
  Selbstlöschschutz bei Usern).
- Neuer Decorator/Guard `@RequirePermission('resource:action')` +
  `PermissionsGuard` ersetzt `@Roles(...)`/`RolesGuard`. Jeder bisherige
  `@Roles(Role.ADMIN, Role.EDITOR, Role.AUTHOR)`-Aufruf wurde 1:1 auf genau
  ein Recht abgebildet (z.B. `content:create`) – die "mehrere Rollen
  erlauben diese Aktion"-Semantik steckt jetzt darin, welche Rollen dieses
  Recht besitzen, nicht mehr in einer Liste am Endpoint.
- `JwtPayload` trägt jetzt `{ sub, email, roleId, roleName, permissions:
  string[] }` statt nur `role: string`. Die Rechte werden bei
  Token-Ausstellung einmal aus der Rolle geladen (`AuthService`, privates
  `issueTokens()`) und ins Access-Token eingebettet.
- Frontend: neue Seite `/dashboard/roles` mit `RoleFormDialog`
  (Create+Edit-Dual-Mode wie `ContentEditorForm`, Checkbox-Matrix der 13
  Rechte gruppiert nach Ressource). `UserRoleSelect`/`CreateUserDialog`
  laden Rollen jetzt dynamisch (`getRoles()`) statt einer hartkodierten
  4-Werte-Map.
- **Zusätzlich, im selben Schema-Umbau gebündelt**: `User.name` wurde zu
  `firstName String?` (optional) + `lastName String` (Pflicht) gesplittet
  (Nutzer-Vorgabe). Neuer Helper `formatName()` (Backend:
  `common/utils/format-name.ts`, Frontend: `lib/utils.ts`) baut daraus den
  Anzeigenamen – genutzt in Sidebar, Content-Autor-/Medien-Uploader-Anzeige,
  Benutzer-Tabelle.

## Warum diese Lösung

- **Rechte bei Token-Ausstellung einbetten statt pro Request aus der DB
  laden**: konsistent mit dem bisherigen Verhalten (Rollenwechsel wirkte
  auch vorher erst nach Token-Ablauf/Refresh, siehe
  [auth-jwt-refresh-rotation.md](./auth-jwt-refresh-rotation.md)) und
  spart einen DB-Join pro Request. Konsequenz: Rechte-Änderungen an einer
  Rolle wirken erst beim nächsten Refresh (≤15 Min) – bewusst in Kauf
  genommen, kein neues Risiko gegenüber vorher.
- **Ein Benutzer = eine Rolle** (kein Multi-Role-Join): nicht gefordert,
  hätte Komplexität ohne genannten Bedarf hinzugefügt.
- **Permissions als fester Code-Katalog, Rollen frei verwaltbar**: Die
  Alternative (auch Permissions frei definierbar) hätte bedeutet, dass
  Permission-Strings nicht mehr 1:1 an tatsächlich vorhandene
  `@RequirePermission(...)`-Aufrufe im Code gebunden sind – ein Admin
  könnte dann Rechte erstellen, die nirgends geprüft werden, oder Endpoints
  referenzieren, die es nicht gibt. Der feste Katalog hält Rechte und
  tatsächlich durchgesetzte Autorisierung synchron.
- **`User.name`-Split im selben Umbau statt separat**: beide Änderungen
  betreffen dieselbe `users`-Migration; getrennt hätte zwei
  Migrationsschritte gegen bestehende Daten bedeutet statt einem.

## Stolpersteine / Besonderheiten

- **Migration auf nicht-leerer Tabelle**: `roleId`/`lastName` als
  Pflichtfelder ohne Default ließen sich nicht gegen die bestehende
  1-Zeilen-`users`-Tabelle migrieren (`prisma migrate dev` bricht mit
  "There are 1 rows in this table" ab, `--create-only` scheitert an
  fehlender Interaktivität in einer nicht-interaktiven Shell). Gelöst durch
  kompletten Reset der Dev-Datenbank (nur Testdaten betroffen, vom Nutzer
  bestätigt) statt manueller Daten-Backfill-SQL.
- **Verwaiste Prozesse blockieren `prisma generate`**: Der laufende
  `nest start --watch`-Prozess (Windows) hielt die Query-Engine-DLL offen
  (`EPERM: operation not permitted, rename ...query_engine-windows.dll.node`),
  `TaskStop` beendet auf Windows nur den Bash-Wrapper, nicht den
  tatsächlichen Node-Kindprozess (gleiches Muster wie in
  [monorepo-setup.md](../tooling/monorepo-setup.md) bereits für
  `prisma migrate dev` dokumentiert – jetzt auch für `nest start --watch`
  bestätigt). Fix: Prozesse über `Get-CimInstance Win32_Process` anhand der
  Commandline identifizieren und gezielt per PID `taskkill /F` beenden.
- **`apps/api/test/prepare-test-db.js` seedete bisher nicht**: Nur
  `prisma db push` (Schema-Sync) lief vor den E2E-Tests, nie
  `seed.ts`. Ohne Rollen in der Testdatenbank wirft
  `AuthService.register()` (`role.findFirstOrThrow({ isDefault: true })`)
  – Skript um einen Seed-Schritt ergänzt.
- **`z.coerce.number()` (zod) kollidiert mit react-hook-forms
  Resolver-Typinferenz** bei einem `type="number"`-Input (Fehler: "Type
  'unknown' is not assignable to type 'number'"). Gelöst durch normales
  `z.number()` im Schema + manuelle `e.target.valueAsNumber`-Konvertierung
  im `onChange` statt `z.coerce`.

## Relevante Dateien

- `packages/database/prisma/schema.prisma`, `prisma/seed.ts`
- `apps/api/src/roles/*`
- `apps/api/src/auth/decorators/permissions.decorator.ts`,
  `guards/permissions.guard.ts`, `strategies/jwt.strategy.ts`,
  `auth.service.ts`
- `apps/api/src/common/utils/format-name.ts`
- Alle Controller (`content`, `media`, `categories`, `tags`, `users`,
  `navigation`, `webhooks`, `settings`, `global-modules`)
- `apps/api/src/global-modules/global-modules.service.ts`
  (`resolveResource`/`resolveResourceForModule`)
- `apps/web/src/app/dashboard/roles/*`,
  `apps/web/src/components/roles-explorer.tsx`,
  `role-form-dialog.tsx`, `lib/permission-labels.ts`
- `apps/web/src/lib/api-server.ts` (`PermissionDescriptor`),
  `lib/utils.ts` (`formatName`)
- `apps/web/src/components/app-sidebar.tsx`, `command-palette.tsx`,
  `admin-menu.tsx`, `apps/web/src/app/dashboard/layout.tsx` (Permission-
  Gates für Nav/UI, nicht nur API-Endpoints)
- `apps/web/src/components/user-row-actions.tsx`, `users-table.tsx`,
  `selection-toolbar.tsx`, `edit-user-dialog.tsx` (`isActive`-Toggle)

## Offene Punkte

- Kein automatisierter Test/Lint-Check, der stale Permission-String-Literale
  im Frontend gegen den Backend-Katalog abgleicht (siehe "Nachtrag" oben –
  wurde diesmal manuell per `grep` gefunden). Ein E2E- oder Unit-Test, der
  `GET /permissions` gegen alle im Frontend verwendeten `permissions.includes(...)`-
  Strings prüft, würde das früher auffangen.
- Keine UI, um zu sehen/filtern, welche User eine bestimmte Rolle haben
  (nur die Anzahl in der Rollen-Tabelle).
- Rechte-Katalog ist an zwei Stellen dupliziert (`apps/api/src/roles/
  permissions.catalog.ts` und `packages/database/prisma/seed.ts`) statt
  über die Package-Grenze geteilt – bewusste Entscheidung gegen zusätzliche
  Export-Konfiguration für 13 feste Einträge, siehe Kommentare in beiden
  Dateien.

## Update 2026-08-16: Mehrfach-Rollen (`User` n:m `Role`)

Voraussetzung für [user-profile-page-plan.md](./user-profile-page-plan.md)
(2b.14), Nutzervorgabe "Benutzer dürfen mehrere Rollen haben". `User.roleId`
(einzelne Pflicht-FK) wurde durch eine `UserRole`-Zwischentabelle ersetzt
(analog zu `RolePermission`).

**Migration (ohne Datenverlust, Windows/`prisma db push`-Workflow):**
1. `UserRole`-Modell additiv hinzugefügt, `User.roleId` vorübergehend
   parallel behalten (temporäre zweite Relation `"LegacyUserRole"`, da
   Prisma bei zwei Beziehungen zwischen denselben Modellen benannte
   Relationen braucht) → `db push` (rein additiv, kein Datenverlust)
2. SQL-Backfill: `INSERT INTO user_roles ("userId","roleId","createdAt")
   SELECT id,"roleId",now() FROM users` – jede bestehende `roleId` wird zur
   ersten `UserRole`-Zeile
3. `User.roleId`/`role` und die temporäre Relation aus dem Schema entfernt
   → `db push --accept-data-loss` (Warnung war erwartet, Daten bereits in
   `user_roles` gesichert)

**Rechte-Vereinigung:** `AuthService.issueTokens()` lädt jetzt
`userRoles.role.permissions` für alle zugewiesenen Rollen und bildet die
Vereinigung (`new Set(...)`) statt eines einzelnen Rollen-Rechte-Sets.
`canAccessDashboard` ist `true`, sobald mindestens eine zugewiesene Rolle es
erlaubt. JWT-Payload trägt entsprechend `roleIds`/`roleNames` als Arrays
(vorher `roleId`/`roleName` als Singular).

**API-Form:** `UsersService` flacht die interne `userRoles`-Join-Tabelle in
der Response zu `roles: {id,name}[]` ab (`toPublicUser()`-Helper), damit das
Frontend nicht die Zwischentabellen-Struktur sehen muss.
`CreateUserDto`/`UpdateUserDto` nehmen `roleIds: string[]` entgegen (ersetzt
`roleId: string`); `UpdateUserDto` ersetzt bei Angabe die komplette
Rollen-Zuordnung (`deleteMany` + `createMany` in einer Transaktion), leeres
Array ist ein Validierungsfehler ("mindestens eine Rolle").

**Sicherheits-Check unverändert relevant:** `assertMayAssignRole()` (siehe
oben, "Nur Administratoren dürfen die Administrator-Rolle vergeben") prüft
jetzt `actingUser.roleNames.includes('Administrator')` und ob
`Administrator` in den neuen `roleIds` enthalten ist – funktioniert mit
Arrays unverändert.

**Frontend, bewusst nur teilweise angepasst:** `CreateUserDialog`/
`EditUserDialog` bieten weiterhin nur eine Einzelauswahl (senden
`roleIds: [gewählteRolle]`) – ein echter Mehrfach-Rollen-Picker ist Teil der
neuen Profilseite (2b.14), noch nicht gebaut. `users-table.tsx` rendert
bereits mehrere Rollen-Badges nebeneinander (`user.roles.map(...)`).
