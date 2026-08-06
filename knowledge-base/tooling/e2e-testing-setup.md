# Erste E2E-Tests: Auth- und Content-Flow, eigene Test-Datenbank

**Datum:** 2026-08-02
**Betroffene Bereiche:** apps/api (`test/*`, `.env.test`, `src/app.module.ts`)

## Was wurde gebaut

- `apps/api/.env.test`: eigene Konfiguration mit `DATABASE_URL` auf eine
  separate Datenbank `strasev_test` (gleicher lokaler Postgres-Container,
  anderer DB-Name) statt der Dev-Datenbank `strasev`.
- `AppModule` lädt `.env.test` statt `.env`, wenn `NODE_ENV=test` gesetzt
  ist (Jest setzt das automatisch selbst, sofern nicht bereits vorhanden).
- `test/prepare-test-db.js`: als `pretest:e2e`-npm-Skript registriert
  (läuft automatisch vor `test:e2e`, pnpm/npm-Konvention). Führt
  `prisma db push --accept-data-loss` mit überschriebener `DATABASE_URL`
  gegen `strasev_test` aus – erstellt die Datenbank bei Bedarf automatisch
  (Prisma legt eine fehlende Postgres-Datenbank selbst an) und synchronisiert
  das Schema, ganz ohne Migrations-Historie (für eine Wegwerf-Testdatenbank
  nicht nötig).
- `test/setup-app.ts`: gemeinsamer `createTestApp()`-Helper, der dieselbe
  Versionierung (`/v1`) und `ValidationPipe`-Konfiguration wie
  `main.ts#bootstrap()` auf die Testinstanz anwendet – ohne das würden alle
  Requests gegen `/v1/...` mit 404 fehlschlagen, da `enableVersioning()`
  sonst nie aufgerufen wird. Helmet/CORS/Swagger werden bewusst NICHT
  repliziert, da sie das Routing-/Validierungsverhalten nicht beeinflussen.
- `test/auth.e2e-spec.ts` (8 Tests): Register, Duplicate-E-Mail-Konflikt,
  Login mit falschem Passwort, `/auth/me` ohne/mit Token, RBAC (Default-Rolle
  `AUTHOR` bekommt 403 auf `/users`), Refresh-Token-Rotation (altes Token
  nach Refresh ungültig), Logout-Widerruf.
- `test/content.e2e-spec.ts` (6 Tests): Create ohne Token → 401, Create →
  `DRAFT` + `publishedAt: null`, List **inklusive Regressionstest für die
  `contentType`-Relation** (siehe unten), Get-by-ID, Update auf
  `PUBLISHED` setzt `publishedAt` und legt eine `ContentVersion` an,
  Delete + anschließendes 404.

## Warum diese Lösung

- **Eigene Testdatenbank statt Dev-Datenbank wiederverwenden**: E2E-Tests
  legen/löschen echte Zeilen. Gegen die Dev-DB zu testen hätte den
  laufenden Dev-Stand (Seed-Admin, während dieser Session testweise
  angelegte Inhalte/Medien) riskiert und macht Tests nicht wiederholbar
  ohne Seiteneffekte auf die manuell im Browser getestete Umgebung.
- **`db push` statt `migrate deploy`**: Für eine Testdatenbank, die bei
  jedem Lauf ohnehin nur mit dem aktuellen Schema übereinstimmen muss
  (keine Notwendigkeit für Migrations-Historie/Rollback), ist `db push`
  einfacher und erstellt die Datenbank bei Bedarf automatisch – kein
  manueller `CREATE DATABASE`-Schritt nötig.
- **Aufräumen in `beforeAll`/`afterAll` statt globalem DB-Reset**: Beide
  Spec-Dateien legen nur ihre eigenen, klar identifizierbaren Testdaten an
  (feste E-Mail-Adressen mit `e2e-`-Präfix, ein dedizierter
  `ContentType`-Slug) und räumen genau diese wieder auf – inklusive einer
  defensiven Bereinigung zu Beginn (`beforeAll`), falls ein vorheriger Lauf
  abgebrochen ist. Das hält die Testdatenbank über mehrere Läufe hinweg
  sauber, ohne dass ein globales "DB komplett leeren"-Skript nötig ist.
- **Regressionstest für die `contentType`-Relation in der Content-Liste**:
  Genau dieser Fehler ist bereits einmal aufgetreten (siehe
  [content-editor-dynamic-forms.md](../content/content-editor-dynamic-forms.md)) –
  `ContentService.findAll()` lud `contentType` zunächst nicht mit, was im
  Frontend erst bei vorhandenen Einträgen als Crash auffiel. Der Test prüft
  jetzt explizit, dass `entry.contentType` in der Listenantwort vorhanden
  ist, damit diese Klasse von Fehler beim nächsten Refactoring der Query
  sofort auffällt statt erst wieder im Frontend.

## Stolpersteine / Besonderheiten

- Ohne `app.enableVersioning(...)` in `createTestApp()` liefen alle
  Requests gegen `/v1/...`-Pfade ins Leere (404) – die Versionierung wird
  ausschließlich in `main.ts#bootstrap()` gesetzt und nicht automatisch von
  `Test.createTestingModule()` übernommen.
- `child_process.spawnSync(..., { shell: true })` mit einem Args-Array löst
  eine Node-Deprecation-Warning aus (`DEP0190`), weil die Argumente beim
  Concat durch die Shell nicht separat escaped werden. Da alle Argumente in
  `prepare-test-db.js` fest im Code stehen (kein externer/Nutzer-Input),
  ist das hier unkritisch – trotzdem als einzelner, bereits zusammengesetzter
  Command-String übergeben statt als Array, um die Warnung zu vermeiden.
- Es existierte bereits eine von der Nest-CLI generierte
  `test/app.e2e-spec.ts` (Health-Check-Test), die beim ursprünglichen
  `nest new` mit angelegt, aber bis jetzt nie ausgeführt/gepflegt wurde –
  läuft unverändert mit.

## Relevante Dateien

- `apps/api/.env.test`
- `apps/api/src/app.module.ts` (`envFilePath`)
- `apps/api/test/prepare-test-db.js`
- `apps/api/test/setup-app.ts`
- `apps/api/test/auth.e2e-spec.ts`
- `apps/api/test/content.e2e-spec.ts`
- `apps/api/package.json` (`pretest:e2e`-Skript)

## Offene Punkte

- Keine Tests für Media-, Users-, Categories-/Tags-Endpoints (Roadmap-Punkt
  war explizit auf Auth- und Content-Flows beschränkt).
- Keine Tests im Frontend (Playwright/Vitest o.ä.) – nur Backend-E2E.
- Keine CI-Pipeline, die `test:e2e` automatisch ausführt (siehe
  [`docs/ROADMAP.md`](../../docs/ROADMAP.md) Phase 3, CI/CD-Pipeline).
