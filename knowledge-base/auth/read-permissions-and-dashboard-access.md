# Lese-Rechte pro Ressource + Dashboard-Zugriff als eigenes Rollen-Flag

> **Update 2026-08-03:** Die Rolle "Betrachter" (in diesem Eintrag
> mehrfach als Beispiel erwähnt) wurde auf Nutzerwunsch wieder entfernt,
> siehe unten "Rollen-Neuordnung". Die neuen `:read`-Rechte selbst bleiben
> bestehen (Editor/Autor/Admin nutzen sie weiterhin) – nur die Rolle, die
> ausschließlich Lesen konnte, gibt es nicht mehr.

**Datum:** 2026-08-03
**Betroffene Bereiche:** apps/api (`src/roles`, `src/content`, `src/media`,
`src/categories`, `src/tags`, `src/auth`), apps/web
(`src/app/dashboard/layout.tsx`, `role-form-dialog.tsx`, `roles/page.tsx`),
packages/database (Schema, Seed)

## Was wurde gebaut

Ausgangsproblem (Nutzer-Feedback): Content/Medien/Kategorien/Tags waren zum
Lesen für **jeden eingeloggten User offen**, unabhängig von Rechten – eine
Rolle wie "Betrachter" mit 0 zugewiesenen Rechten konnte trotzdem alles
sehen, weil Lesen nie an ein Recht gebunden war (nur Schreiben). Außerdem
gab es keine Möglichkeit, einen Account anzulegen, der sich zwar einloggen,
aber das Backend-Dashboard gar nicht öffnen kann.

- **Neue Rechte im Katalog**: `content:read`, `media:read`,
  `categories:read`, `tags:read` (vorher gab es für diese vier Ressourcen
  nur `create`/`update`/`delete`, kein `read`). `GET`-Endpoints der
  jeweiligen Controller sind jetzt mit `@RequirePermission('<resource>:read')`
  gesperrt, vorher ganz ohne Permission-Check.
- **Neues Feld `Role.canAccessDashboard`** (Default `true`): steuert, ob
  Benutzer mit dieser Rolle `/dashboard/*` überhaupt öffnen dürfen – völlig
  unabhängig von einzelnen Ressourcen-Rechten. Wird wie `permissions` bei
  Token-Ausstellung ins JWT eingebettet (`AuthService.issueTokens()`) und
  über `GET /auth/me` ans Frontend gereicht.
- `apps/web/src/app/dashboard/layout.tsx` prüft `user.canAccessDashboard`
  direkt nach dem Auth-Check; bei `false` wird statt Sidebar+Content die
  neue Komponente `NoDashboardAccess` gerendert (Meldung + Abmelden-Button)
  – kein Redirect-Loop-Risiko wie bei einem Redirect nach `/login`, da der
  User ja gültig eingeloggt ist, nur nicht fürs Dashboard autorisiert.
- **Rollen-Neuordnung** (`packages/database/prisma/seed.ts`): vierte Rolle
  "Nutzer" eingeführt – 0 Rechte, `canAccessDashboard: false`, jetzt
  `isDefault: true` (übernimmt die Default-Rolle von "Autor", die diese
  Kennzeichnung verliert). Das bedeutet: **Selbstregistrierte Benutzer
  bekommen ab sofort keine Bearbeitungsrechte im CMS mehr automatisch** –
  vorher landete jeder `/register`-Account direkt als "Autor" mit
  Content-/Medien-Schreibrechten. ~~"Betrachter" bekommt jetzt die vier
  neuen `:read`-Rechte zugewiesen~~ – die Rolle "Betrachter" wurde direkt
  im Anschluss auf Nutzerwunsch wieder entfernt (aus `seed.ts` gestrichen,
  Rolle aus Dev-/Test-DB gelöscht; der einzige zugewiesene Test-Account
  wurde vorher auf "Nutzer" umgehängt). Übrig bleiben vier Rollen:
  Admin/Editor/Autor/Nutzer.
- `RoleFormDialog` (Rollen-UI) hat einen neuen Switch "Zugriff auf das
  Backend-Dashboard", `actionLabels` um `read: "Lesen"` ergänzt.
  `roles/page.tsx` zeigt eine "Dashboard"-Spalte (Ja / Badge "Kein
  Zugriff").

## Warum diese Lösung

- **Zwei getrennte Achsen statt einer**: "darf X lesen/schreiben" (fein
  differenziert pro Ressource) und "darf überhaupt ins Dashboard"
  (grobkörnig, alles-oder-nichts) sind unterschiedliche Fragen. Ein Modell
  mit nur Ressourcen-Rechten hätte "Nutzer ohne Dashboard-Zugriff" nur über
  "Rolle mit 0 Rechten" simuliert – das UI wäre aber trotzdem aufrufbar
  gewesen (nur leer/fehlerhaft statt sauber blockiert). Das eigene Flag
  macht die Absicht explizit und blockiert das gesamte Dashboard, nicht nur
  einzelne Listen.
- **"Nutzer" wird die neue Default-Rolle statt "Autor"**: Es gibt in diesem
  Projekt aktuell **kein öffentliches Frontend** – `apps/web` ist
  ausschließlich das Admin-Dashboard. Registrierung war vorher faktisch
  "jeder kann sich selbst Redakteursrechte im CMS geben", was nicht
  beabsichtigt war. Mit `canAccessDashboard: false` als Default ist
  Selbstregistrierung jetzt ein reiner Account ohne jede CMS-Berechtigung;
  ein Admin muss aktiv eine andere Rolle zuweisen, damit jemand tatsächlich
  etwas im Dashboard tun kann. Kombiniert mit
  [admin-activation-and-permission-nav.md](./admin-activation-and-permission-nav.md)
  (optionale Freischaltungspflicht) ergibt das einen zweistufigen Prozess:
  registrieren → (optional: Admin aktiviert) → (Admin weist bei Bedarf eine
  Backend-Rolle zu).
- **Rollen, die schreiben dürfen, brauchen weiterhin explizit `:read`**:
  Editor/Autor/Admin bekommen die neuen Lese-Rechte automatisch mit, weil
  die bestehenden Filter (`["content","media",...].includes(p.resource)`
  bzw. `p.action !== "delete"`) den neuen `read`-Eintrag im `PERMISSIONS`-
  Array einschließen. Ohne das hätten diese Rollen z.B. Content anlegen,
  aber die eigene Liste danach nicht mehr sehen können.

## Stolpersteine / Besonderheiten

- **Seed-`upsert` aktualisierte `isDefault`/`canAccessDashboard` bei
  bereits existierenden Rollen ursprünglich nicht** – der `update:`-Zweig
  enthielt nur `description`. Da "Autor" in der Dev-DB schon als
  `isDefault: true` existierte, hätte ein erneuter Seed-Lauf sonst *zwei*
  Default-Rollen gleichzeitig aktiv gehabt (`role.findFirstOrThrow({
  isDefault: true })` in `AuthService.register()` hätte dann nicht
  deterministisch die neue "Nutzer"-Rolle getroffen). Fix: `update:` setzt
  jetzt `isDefault`/`canAccessDashboard` bei jedem Seed-Lauf explizit neu.
- **Scheinbarer 403-Bug beim Testen, der keiner war**: Ein isolierter
  `pnpm exec jest content.e2e-spec.ts`-Aufruf (ohne den vorgeschalteten
  `node test/prepare-test-db.js`-Schritt aus dem `test:e2e`-Skript) nutzt
  automatisch die **Dev-Datenbank** (`DATABASE_URL` aus `apps/api/.env`)
  statt der Wegwerf-Testdatenbank, da `prepare-test-db.js` `DATABASE_URL`
  nur für die von ihm gestarteten Subprozesse setzt, nicht für den eigenen
  Prozess. Die Dev-DB war zu dem Zeitpunkt noch nicht neu geseedet (siehe
  unten) → alte Rollen ohne `:read`-Rechte → 403 auf `GET /content`. Kein
  Code-Bug; Lehre: e2e-Einzeltests immer über `pnpm test:e2e` (oder
  zumindest nach manuellem `prepare-test-db.js`-Lauf) ausführen, nie
  `jest` direkt gegen ein einzelnes Spec-File ohne diesen Schritt.
- Wie schon bei früheren Schema-Änderungen: `prisma migrate dev` /
  `prisma generate` scheiterten zunächst an `EPERM`, weil ein laufender
  `nest start --watch`-Prozess die Query-Engine-DLL offen hielt (siehe
  bereits dokumentiertes Muster in
  [rbac-rework.md](./rbac-rework.md)) – über `Get-CimInstance
  Win32_Process` + `taskkill` behoben.

## Relevante Dateien

- `packages/database/prisma/schema.prisma` (`Role.canAccessDashboard`),
  `prisma/seed.ts`
- `apps/api/src/roles/permissions.catalog.ts`, `roles.service.ts`,
  `dto/create-role.dto.ts`, `dto/update-role.dto.ts`
- `apps/api/src/content/content.controller.ts`,
  `media/media.controller.ts`, `categories/categories.controller.ts`,
  `tags/tags.controller.ts` (`:read`-Guards)
- `apps/api/src/auth/auth.service.ts`, `auth.controller.ts`,
  `strategies/jwt.strategy.ts` (`canAccessDashboard` im JWT)
- `apps/web/src/app/dashboard/layout.tsx`,
  `src/components/no-dashboard-access.tsx`
- `apps/web/src/components/role-form-dialog.tsx`,
  `src/app/dashboard/roles/page.tsx`
- `apps/web/src/lib/api-server.ts` (`Role.canAccessDashboard`,
  `CurrentUser.canAccessDashboard`)
- `apps/api/test/content.e2e-spec.ts` (musste implizit weiterhin
  funktionieren, da der Test-User dort die Admin-Rolle bekommt – keine
  Testanpassung nötig)

## Offene Punkte

- Keine eigene UI-Kennzeichnung für "wartet auf Rollenzuweisung" – ein
  frisch registrierter "Nutzer" sieht in der Benutzerverwaltung wie jeder
  andere User aus, nur eben mit der Rolle "Nutzer" statt "Deaktiviert"-
  Badge o.ä.
- Keine Bulk-Aktion, um mehrere wartende "Nutzer"-Accounts auf einmal einer
  Backend-Rolle zuzuweisen (nur einzeln über den Rollen-Select in der
  Benutzertabelle).
