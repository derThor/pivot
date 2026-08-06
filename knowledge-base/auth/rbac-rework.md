# Von 4 festen Rollen zu granularem, admin-verwaltbarem RBAC

**Datum:** 2026-08-03
**Betroffene Bereiche:** apps/api (`src/roles`, `src/auth`, alle Controller),
apps/web (`src/app/dashboard/roles`, diverse Komponenten),
packages/database (Schema, Seed)

## Was wurde gebaut

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
- Alle Controller (`content`, `media`, `categories`, `tags`, `users`)
- `apps/web/src/app/dashboard/roles/*`,
  `apps/web/src/components/role-form-dialog.tsx`,
  `role-row-actions.tsx`
- `apps/web/src/lib/api-server.ts`, `lib/utils.ts` (`formatName`)

## Offene Punkte

- Keine UI, um zu sehen/filtern, welche User eine bestimmte Rolle haben
  (nur die Anzahl in der Rollen-Tabelle).
- Rechte-Katalog ist an zwei Stellen dupliziert (`apps/api/src/roles/
  permissions.catalog.ts` und `packages/database/prisma/seed.ts`) statt
  über die Package-Grenze geteilt – bewusste Entscheidung gegen zusätzliche
  Export-Konfiguration für 13 feste Einträge, siehe Kommentare in beiden
  Dateien.
