# Admin-Einstellungen: konfigurierbare Passwort-Policy und Feature-Schalter

**Datum:** 2026-08-03
**Betroffene Bereiche:** apps/api (`src/settings`), apps/web
(`src/app/dashboard/settings`, `src/app/dashboard/account`,
`src/lib/password-policy.ts`)

> **Update 2026-08-05 (Logo-Upload + Firmenangaben):** Neuer Tab "Firma"
> in `settings-form.tsx`: zwei Logo-Uploads (`logoExpandedUrl`/
> `logoCollapsedUrl`, für die Sidebar im aus-/eingeklappten Zustand) und
> 11 Freitext-Firmenfelder für Impressum/Datenschutz (Name, Adresse,
> Vertretung, Kontakt, Handelsregister, USt-IdNr.). Details siehe
> [design-refresh.md](../frontend/design-refresh.md#logo-firmenangaben-2026-08-05).
> Beide Logo-Felder **und** alle Firmenfelder sind Teil von `GET
> /settings/public` – genau derselbe Grund wie bei `defaultPageSize`
> weiter oben: die Sidebar muss die Logos für jede Rolle mit
> Dashboard-Zugriff laden können, nicht nur für Admins mit
> `settings:manage`.
> - **Logo-Upload läuft über den bestehenden `POST /media`-Endpoint**
>   statt eines eigenen Upload-Pfads – Logos landen dadurch auch als
>   normale Einträge in der Medienbibliothek (bewusster Kompromiss,
>   spart einen zweiten, fast identischen Upload-Mechanismus nur für
>   Branding-Bilder).
> - **Firmenfelder liegen außerhalb des Zod/`react-hook-form`-Schemas**
>   der übrigen Einstellungen (eigener `useState`, initialisiert aus
>   `settings.company*`), werden aber beim Submit in **denselben**
>   `PATCH /api/settings`-Aufruf gemischt (`{...values, ...companyValues}`)
>   – reine Freitext-Felder ohne Validierungsbedarf, ein zweites
>   Zod-Schema nur dafür hätte keinen echten Nutzen gebracht.
> - **Logo-Uploads speichern sofort** (eigener `PATCH` pro Feld direkt
>   nach dem Hochladen, nicht erst beim großen "Einstellungen
>   speichern"-Klick) – konsistent mit dem Muster aus
>   `media-card-actions.tsx` (Alt-Text-Dialog speichert auch sofort),
>   und vermeidet, dass ein Nutzer ein Logo hochlädt, den Tab wechselt
>   und die Zuordnung durch einen vergessenen Klick auf "Speichern"
>   wieder verliert.
> - **Logo löschbar**: `LogoUploadField` bekam einen zusätzlichen
>   Löschen-Button (nur sichtbar, wenn eine URL gesetzt ist), der
>   sofort `PATCH {[field]: null}` sendet. `logoExpandedUrl`/
>   `logoCollapsedUrl` im `UpdateSettingsDto` wurden dafür von
>   `string?` auf `string | null` erweitert (`@IsOptional()` lässt
>   sowohl `null` als auch `undefined` durch, nur der TS-Typ war zu eng).
> - **Datei-Input und "Hochladen"-Button stehen nebeneinander** (nicht
>   mehr gestapelt), zusätzlich ein Löschen-Icon-Button daneben, wenn
>   bereits ein Logo gesetzt ist.
> - **Sidebar-Rendering (`app-sidebar.tsx`)**: Die kleine Icon-Kachel
>   (S-Fallback oder `logoCollapsedUrl`) ist jetzt nur im eingeklappten
>   Zustand sichtbar (`w-0 opacity-0` wenn ausgeklappt, `w-8
>   opacity-100` wenn eingeklappt – exakt spiegelverkehrt zum
>   Wortmarken-Text/`logoExpandedUrl`, der nur ausgeklappt sichtbar
>   ist). Ursprünglich waren beide gleichzeitig sichtbar (Icon **und**
>   Wortmarke nebeneinander im ausgeklappten Zustand) – auf
>   Nutzerwunsch ("das S muss weg, durch das Logo ersetzt werden")
>   umgestellt, sodass ausgeklappt **nur** die große Wortmarke und
>   eingeklappt **nur** die kleine Icon-Kachel zu sehen ist, nie beide
>   gleichzeitig.
> - **Tab "Firma" ist jetzt der Default-Tab** (`defaultValue="company"`
>   statt `"access"`) und steht in der `TabsList` an erster Stelle;
>   innerhalb des Tabs steht die Firmenangaben-Karte über der
>   Logo-Karte (ursprünglich umgekehrt).
> - **Settings-Formular nutzt die volle Breite** (`max-w-2xl` entfernt)
>   – nötig, damit das zweispaltige Firmenangaben-Grid genug Platz hat.
>
> **Stolperstein, der sich als Fehlalarm herausstellte**: Nach diesen
> Änderungen schlugen plötzlich 4 unabhängig wirkende E2E-Tests fehl
> (`P2022: column "app_settings.defaultPageSize" does not exist`).
> Ursache war **nicht** der neue Code, sondern dass die Test-Datenbank
> (`pivot_test`) nie mit den neuesten Migrationen synchronisiert
> wurde – `package.json` hat einen `pretest:e2e`-Hook
> (`node test/prepare-test-db.js`, führt `prisma db push` gegen die
> Test-DB aus), der nur bei `pnpm test:e2e` automatisch feuert, nicht
> bei einem direkten `npx jest --config ./test/jest-e2e.json`-Aufruf.
> Seitdem in dieser Session wiederholt direkt `npx jest` statt `pnpm
> test:e2e` verwendet wurde, lief die Test-DB der Schema-Historie
> hinterher. Fix: einmalig `pnpm test:e2e` ausführen (synchronisiert
> automatisch) – künftig immer `pnpm test:e2e` statt direktem
> `npx jest`-Aufruf verwenden (als Feedback-Memory hinterlegt).

> **Update 2026-08-06 (Logo-Ordner + echtes Löschen):** Auf
> Nutzer-Feedback ("beim Logo ist was durcheinander", Logo landet nicht
> im richtigen Feld / wird nicht dauerhaft angezeigt) wurde die gesamte
> Logo-Verwaltung robuster gemacht, nachdem eine sorgfältige
> Nachstellung über die exakt gleichen BFF-Routen wie der Browser
> **keinen** Backend-seitigen Fehler zeigte (beide Felder blieben in
> mehreren Testläufen sauber getrennt – `logoExpandedUrl`/
> `logoCollapsedUrl` wurden nie vertauscht). Die wahrscheinlichste
> Ursache für die gemeldeten Symptome: einer der zahlreichen Dev-Server-
> Neustarts in dieser Session traf zeitlich mit dem eigenen Testen des
> Nutzers zusammen (bekanntes Turbopack-HMR-Stale-State-Muster, das in
> dieser Session mehrfach aufgetreten ist). Trotzdem wurden zwei echte
> Verbesserungen umgesetzt, die unabhängig vom ursprünglichen Bug Sinn
> ergeben:
> - **Logo-Uploads landen jetzt in einem eigenen, geschützten
>   "Logo"-Systemordner** (`MediaFolder.isSystem`, siehe
>   [media-folders.md](../media/media-folders.md)) statt im Root der
>   Medienbibliothek – `LogoUploadField` bekommt die Ordner-ID über
>   `dashboard/settings/page.tsx` → `getMediaFolders()` →
>   `folders.find(f => f.isSystem)` durchgereicht (Suche über das
>   `isSystem`-Flag, nicht über den Namen "Logo" als String – bleibt
>   auch bei einer Umbenennung des Ordners stabil).
> - **"Löschen" entfernt jetzt wirklich die Datei**, nicht nur die
>   Zuordnung in den Einstellungen: `LogoUploadField.handleRemove()`
>   sucht den Medien-Eintrag im Logo-Ordner anhand der aktuell
>   gespeicherten URL (`GET /media?folderId=...`) und ruft `DELETE
>   /media/:id` zusätzlich zum `PATCH {field: null}` auf. Dieselbe
>   Aufräum-Logik läuft auch beim **Ersetzen** eines Logos (neues Bild
>   hochladen, altes wird automatisch entfernt) – verhindert, dass sich
>   im Logo-Ordner bei jedem Austausch verwaiste Dateien ansammeln.

> **Update 2026-08-06 (Test-DB-Verwechslung – echte Ursache gefunden,
> Korrektur des obigen Fehlalarms):** Der oben dokumentierte "vermutlich
> Turbopack-Stale-State"-Befund war **falsch**. Tatsächliche Ursache:
> ein `pnpm test:e2e`-Lauf hat gegen die **Dev-Datenbank** (`pivot`)
> statt gegen `pivot_test` gearbeitet und dabei den
> `auth-security.e2e-spec.ts`-Settings-Test inkl. dessen Aufräum-`PATCH`
> (`logoExpandedUrl: '', logoCollapsedUrl: '', companyName: '', ...`)
> gegen echte Nutzerdaten ausgeführt – das zuvor hochgeladene Logo wurde
> dadurch aus den Einstellungen gelöscht (Datei blieb im Medien-Ordner
> erhalten, nur der Settings-Zeiger wurde überschrieben). Die Sidebar
> zeigte danach noch das alte Logo (Layout-Segment wird bei
> Client-Navigation zwischen Geschwister-Seiten nicht neu vom Server
> geholt), während die Settings-Seite korrekt "Kein Bild" anzeigte –
> genau das vom Nutzer gemeldete Symptom ("oben links hinterlegt, aber
> in den Einstellungen nicht sichtbar/löschbar"). Wiederhergestellt
> durch manuelles `PATCH logoExpandedUrl` auf die noch vorhandene Datei.
>
> **Root Cause:** `AppModule`s `ConfigModule.forRoot({ envFilePath:
> NODE_ENV === 'test' ? '.env.test' : '.env' })` wählt zwar korrekt die
> Datei aus, aber `@pivot/database`s `package.json#main` zeigt direkt
> auf den generierten Prisma-Client (`generated/client/index.js`).
> Prisma-Clients laden beim ersten `require()` **selbst** automatisch
> eine `.env`-Datei relativ zum Schema-Verzeichnis
> (`packages/database/.env`, enthält die **Dev**-`DATABASE_URL`) – und
> das passiert, weil TypeScripts Import-zu-`require()`-Kompilierung alle
> Top-Level-Imports (inkl. `PrismaModule` → `@pivot/database`) vor den
> Code im Modul-Body hebt, **bevor** `ConfigModule.forRoot()` überhaupt
> ausgeführt wird. `dotenv` überschreibt keine bereits gesetzten
> `process.env`-Variablen – der später ladende `.env.test`-Versuch von
> NestJS kam also immer zu spät. **`NODE_ENV=test` allein reicht dadurch
> nicht aus**, um die Test-DB zu erzwingen (auch mit `cross-env
> NODE_ENV=test` gesetzt, blieb `DATABASE_URL` auf dem Dev-Wert – per
> Debug-Log direkt verifiziert).
>
> **Fix (zwei Ebenen):**
> 1. `apps/api/package.json`: `test:e2e`-Skript setzt jetzt
>    `DATABASE_URL` **direkt** als Prozess-Umgebungsvariable
>    (`cross-env NODE_ENV=test DATABASE_URL=...pivot_test... jest
>    --config ./test/jest-e2e.json`) – umgeht das Dotenv-Wettrennen
>    komplett, exakt das gleiche Muster, das `prepare-test-db.js` für
>    den `prisma db push`-Schritt bereits einsetzte (dort war es nie ein
>    Problem, weil `DATABASE_URL` dort explizit im `env`-Objekt des
>    gespawnten Kindprozesses überschrieben wird statt aus einer Datei
>    geladen zu werden).
> 2. `apps/api/test/setup-app.ts`: `createTestApp()` prüft jetzt vor dem
>    Bootstrap per `assertTestDatabase()`, ob `DATABASE_URL` den String
>    `_test` enthält, und wirft sonst einen harten Fehler. Sicherheitsnetz
>    zusätzlich zu Fix 1, unabhängig davon, wie ein zukünftiger e2e-Lauf
>    gestartet wird (IDE-Runner, CI, o.ä.).
>
> **Verifiziert:** `pnpm test:e2e` (60/60 grün) lässt `updatedAt` des
> Dev-`AppSettings`-Datensatzes unverändert (vorher/nachher per `curl`
> gegen die laufenden Dev-Server geprüft).

> **Update 2026-08-04:** Neues Feld `defaultPageSize` (Int, Default 10,
> 1-100) – steuert die Seitengröße auf allen paginierten Listen-Ansichten
> (siehe [pagination.md](../frontend/pagination.md)). Eigener neuer Tab
> "Darstellung" in `settings-form.tsx`. Diesmal von Anfang an in `GET
> /settings/public` mit aufgenommen (nicht erst in `GET /settings`) –
> genau die Lehre aus dem `allowEmailChange`-Stolperstein unten: jede
> Rolle mit Dashboard-Zugriff muss den Wert lesen können, nicht nur
> Admins mit `settings:manage`.

## Was wurde gebaut

- `AppSettings`: ein Singleton-Datensatz (feste `id=1`) statt einer
  generischen Key-Value-Tabelle, mit den Feldern `allowRegistration`,
  `allowPasswordReset`, `allowEmailChange`, `passwordMinLength`,
  `passwordRequireUppercase/Lowercase/Number/SpecialChar`.
- Neues Backend-Modul `src/settings`: `GET/PATCH /settings`
  (`@RequirePermission('settings:manage')`, nur Admin per Default-Rollen),
  `GET /settings/public` (`@Public()`, liefert die Felder, die auch
  unangemeldete Seiten brauchen – Registrierung, Passwort-vergessen,
  Passwort-Policy-Anzeige).
- `password-policy.ts` (Backend): `validatePasswordAgainstPolicy(password,
  settings): string[]` – prüft zur Laufzeit gegen die aktuell in der DB
  gespeicherte Policy, genutzt von `AuthService.register/changePassword/
  resetPassword` und `UsersService.create`. Bewusst **kein** statischer
  `class-validator`-Decorator auf dem DTO, weil die Regeln jetzt
  admin-konfigurierbar sind und zur Validierungszeit ein DB-Lookup nötig
  ist.
- Frontend: der bereits vorhandene, aber bis dahin funktionslose
  "Einstellungen"-Navigationspunkt (`/dashboard/settings`) bekommt eine
  echte Seite mit Schaltern (neue `Switch`-Komponente per shadcn-CLI
  ergänzt, gab es vorher nicht im Projekt) und der Passwort-Richtlinie.
  `lib/password-policy.ts` (Frontend-Pendant, gleiche Regeln) +
  `PasswordPolicyChecklist`-Komponente (Live-Haken/Kreuz-Liste unter jedem
  Passwort-Feld) werden in allen Passwort-Formularen wiederverwendet:
  Benutzer anlegen, Registrierung, Passwort ändern, Passwort zurücksetzen.

## Warum diese Lösung

- **Singleton statt Key-Value-Tabelle**: die Menge der Einstellungen ist
  bekannt und fest, kein Bedarf an beliebig neuen Einstellungen zur
  Laufzeit – ein typisiertes Singleton ist einfacher zu lesen/validieren
  als generisches Key-Value mit String-Keys.
- **`GET /settings/public` als eigener, bewusst schmalerer Endpoint**: Die
  Registrierungs-/Passwort-vergessen-Seiten sind öffentlich (keine
  Auth-Cookie), brauchen aber trotzdem die Passwort-Policy, um das
  Formular clientseitig korrekt zu validieren – ohne diesen Endpoint hätte
  entweder `GET /settings` komplett offen sein müssen (zu weitgehend,
  hätte z.B. auch `allowEmailChange` öffentlich exponiert) oder es hätte
  gar keine serverseitige Policy-Quelle für öffentliche Formulare gegeben.
- **Policy-Prüfung in der Service-Schicht statt DTO-Decorator**:
  vermeidet die Komplexität eines async, DI-fähigen
  `class-validator`-Custom-Constraints (der `SettingsService` injizieren
  müsste) und bleibt konsistent mit dem bereits bestehenden Muster der
  E-Mail-Konflikt-Prüfung in `UsersService`/`AuthService`.

## Stolpersteine / Besonderheiten

- **`allowEmailChange` fehlte zunächst in `GET /settings/public`**: Die
  Konto-Seite (`/dashboard/account`, jeder eingeloggte User, nicht nur
  Admin) muss wissen, ob sie das E-Mail-Feld schreibgeschützt rendern soll
  – aber ein normaler User hat kein `settings:manage`-Recht für `GET
  /settings`. Ursprünglich war `allowEmailChange` bewusst aus der
  "public"-Antwort ausgeschlossen (Gedanke: nur für Admin-Kontext
  relevant) – das war falsch, da auch nicht-öffentliche, aber
  nicht-Admin-Seiten diesen Wert brauchen. Nachträglich ergänzt; die
  Unterscheidung ist jetzt nicht "öffentlich vs. Admin", sondern "für
  irgendeine Seite/Formular nötig vs. nur für die Einstellungen-Seite
  selbst".
- Seed-Passwort `ChangeMe123!` erfüllt zufällig bereits alle vier
  Standard-Komplexitätsregeln (Großbuchstabe, Kleinbuchstabe, Ziffer,
  Sonderzeichen) – die Defaults (`passwordRequireUppercase` usw. = `true`)
  brechen dadurch keine bestehenden Test-/Seed-Logins.

## Relevante Dateien

- `packages/database/prisma/schema.prisma` (`AppSettings`)
- `apps/api/src/settings/*`
- `apps/web/src/app/dashboard/settings/page.tsx`,
  `src/components/settings-form.tsx`
- `apps/web/src/lib/password-policy.ts`,
  `src/components/password-policy-checklist.tsx`
- `apps/web/src/components/ui/switch.tsx`,
  `src/components/ui/checkbox.tsx` (beide neu per shadcn-CLI)

## Offene Punkte

- Keine Historie/Audit-Trail für Settings-Änderungen (nur `updatedAt` am
  Singleton, kein "wer hat wann was geändert").
