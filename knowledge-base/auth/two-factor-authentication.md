# TOTP-basierte Zwei-Faktor-Authentifizierung (2FA)

**Datum:** 2026-08-17
**Betroffene Bereiche:** apps/api (`src/auth`, `src/settings`, `src/users`),
apps/web (`src/components/two-factor-setup-card.tsx`, `src/components/
login-form.tsx`, `src/components/settings-form.tsx`, `src/components/
account-tabs.tsx`, `src/components/user-edit-view.tsx`, `src/components/
users-table.tsx`), `packages/database/prisma/schema.prisma`

Löst den seit 2026-08-16 in `docs/ROADMAP.md` (Phase 3, "2FA/TOTP")
vorgesehenen Platzhalter-Switch in der Benutzer-Profilseite und die
Platzhalter-Spalte in der Benutzertabelle ein.

## Was wurde gebaut

- **Libraries:** `otplib` (v13, funktionale API: `generateSecret`,
  `generateURI`, `verify`) statt `speakeasy` (unmaintained, kein natives
  TS) + `qrcode` für den QR-Code als Data-URL.
- **Schema:** `User.twoFactorSecret` (AES-256-GCM-verschlüsselt, neuer
  `TOTP_ENCRYPTION_KEY`-Env-Var, siehe `common/utils/totp-encryption.ts`),
  `User.twoFactorEnabled`, `User.twoFactorRecoveryCodes` (`String[]`,
  einzeln argon2-gehashte Einmal-Codes). `AppSettings.allowTwoFactor`
  (globaler Feature-Schalter, Default `true`) und
  `AppSettings.requireTwoFactorForAdmins` (Default `false`).
- **Login-Flow (Option "kein Token vor 2FA", Nutzerentscheidung
  2026-08-17):** `AuthService.login()` gibt bei aktivem 2FA **keine**
  echten Tokens zurück, sondern `{ mfaRequired: true, challengeToken }`.
  Das Challenge-Token ist ein 5-Minuten-JWT mit `purpose: 'mfa-challenge'`,
  signiert mit demselben `JWT_ACCESS_SECRET`, aber `JwtStrategy.validate()`
  weist jeden Token mit dieser Markierung hart ab – es taugt für nichts
  außer `POST /auth/2fa/login-verify` (dort manuell per
  `jwt.verifyAsync()` entschlüsselt, nicht über die Strategy). Erst nach
  gültigem TOTP- oder Recovery-Code läuft `issueTokens()` wie beim
  normalen Login.
- **Self-Service** (`/dashboard/account`, Tab "Sicherheit",
  `TwoFactorSetupCard`): `POST /auth/2fa/setup` erzeugt+verschlüsselt ein
  Secret (scharf erst nach Bestätigung), `POST /auth/2fa/verify-setup`
  bestätigt mit dem ersten Code, aktiviert 2FA und liefert 10
  Recovery-Codes **einmalig** im Klartext. `POST /auth/2fa/disable`
  verlangt eine Passwort-Bestätigung (kein weiterer TOTP-Code – der
  Nutzer will den zweiten Faktor gerade loswerden).
- **Erzwingung für Admins:** `AuthService.issueTokens()` setzt
  `twoFactorSetupRequired: true` im JWT, wenn `allowTwoFactor &&
  requireTwoFactorForAdmins &&` Administrator-Rolle `&& !twoFactorEnabled`.
  Neuer `TwoFactorSetupGuard` (1:1 nach dem Vorbild von
  `PasswordChangeGuard`/`mustChangePassword`) sperrt dann alle Routen
  außer den mit `@AllowTwoFactorSetupRequired()` markierten (`/auth/me`,
  `/auth/password`, `/auth/2fa/setup`, `/auth/2fa/verify-setup`).
- **Admin-Notausgang:** `POST /users/:id/disable-2fa`
  (`users:update`-Recht, kein neues eigenes Recht, gleiche Einordnung wie
  das erzwungene `mustChangePassword` in `UpdateUserDto`) – für
  Geräteverlust ohne verbliebenen Recovery-Code. Ohne
  Passwort-Bestätigung: der Admin bestätigt sich bereits über sein eigenes
  Recht, nicht über das Passwort des betroffenen Nutzers.
- **"Wenn deaktiviert, nicht mehr anzeigen"** (Nutzervorgabe): bei
  `allowTwoFactor: false` überspringt `login()` die 2FA-Abfrage komplett,
  auch wenn einzelne Nutzer sie zuvor eingerichtet hatten;
  `TwoFactorSetupCard` rendert `null`; die Header-Badge in
  `UserEditView` wird ausgeblendet; `users-table.tsx` zeigt einen
  neutralen, gemuteten Icon-Status statt echter Werte.
- **Admin-Einstellungen:** Tab "Passwort-Richtlinie" in
  `settings-form.tsx` umbenannt zu "Sicherheit" (Tab-`value` bewusst
  unverändert `password-policy` gelassen, nur das Label geändert), neue
  Karte "Zwei-Faktor-Authentifizierung (2FA)" darunter mit den zwei
  Schaltern. `requireTwoFactorForAdmins` ist deaktiviert/ausgegraut,
  solange `allowTwoFactor` aus ist (`SwitchRow` bekam dafür eine neue
  `disabled`-Prop).

## Warum diese Lösung

- **Kein Token vor bestandener 2FA statt "Token sofort + Guard sperrt":**
  Nutzerentscheidung 2026-08-17 gegen das naheliegendere
  `mustChangePassword`-Muster (Tokens sofort, Guard sperrt danach) – ein
  gestohlener Access-Token kann 2FA so nie umgehen, weil er vor bestandener
  Prüfung schlicht nicht existiert. Kostet einen zusätzlichen
  Token-Typ (Challenge-Token) statt Wiederverwendung der bestehenden
  Guard-Infrastruktur, wurde aber bewusst in Kauf genommen.
- **Secret verschlüsselt, nicht gehasht:** anders als Passwörter/Tokens
  muss das TOTP-Secret bei jeder Prüfung im Klartext vorliegen (der
  Server berechnet den erwarteten Code selbst) – Hashing wie bei
  `passwordHash` funktioniert hier grundsätzlich nicht.
- **Recovery-Codes als `String[]`-Spalte statt eigene Tabelle:** feste,
  kleine Menge (10), gehört untrennbar zum 2FA-Lifecycle eines einzelnen
  Nutzers (wird bei jeder Neueinrichtung komplett ersetzt) – eine
  Zwischentabelle wie bei `RefreshToken`/`PasswordResetToken` hätte hier
  keinen zusätzlichen Nutzen gebracht.
- **`requireTwoFactorForAdmins` erzwingt einen echten Lockout, keinen
  Bypass:** Ein Administrator, der durch `TwoFactorSetupGuard` gesperrt
  ist, kann `PATCH /settings` (und damit die Anforderung selbst) **nicht**
  erreichen, ohne entweder 2FA einzurichten oder einen zweiten,
  bereits konformen Admin-Account zu nutzen – `/settings` ist bewusst
  **nicht** mit `@AllowTwoFactorSetupRequired()` versehen. Alles andere
  hätte die Erzwingung wirkungslos gemacht (jeder betroffene Admin hätte
  sich selbst freischalten können, ohne je 2FA einzurichten). Exakt
  dasselbe Prinzip wie bei `mustChangePassword` – kein Bypass für die
  eigene Auflage.
- **Admin-Disable ohne eigenes Recht:** `users:update` statt eines neuen
  `users:manage-2fa`, um die granulare Rechte-Landschaft (siehe
  [rbac-rework.md](./rbac-rework.md)) nicht für eine reine
  Feld-Änderung am Nutzer unnötig zu vergrößern – bewusst anders als
  `users:deactivate`/`users:delete`/`users:impersonate`, die jeweils
  einen qualitativ eigenen Vertrauens-Level abbilden.

## Stolpersteine / Besonderheiten

- **Zod strippt unbekannte Env-Keys:** `apps/api/src/common/config/
  env.validation.ts` validiert `process.env` per `zodSchema.safeParse()`
  und NestJS übernimmt nur `result.data` – ein Env-Var, das in `.env`
  steht, aber nicht im Zod-Schema deklariert ist, existiert für
  `ConfigService` schlicht nicht (`getOrThrow` wirft "Configuration key
  ... does not exist", keine Zeile Fehlermeldung deutet auf die
  eigentliche Ursache hin). `TOTP_ENCRYPTION_KEY` musste zusätzlich zum
  Eintrag in `.env`/`.env.example`/`.env.test` auch ins Schema
  aufgenommen werden.
- **otplib wirft bei falscher Code-Länge, statt `{valid:false}`
  zurückzugeben:** `verify({ secret, token })` wirft ein
  `TokenLengthError`, wenn `token` nicht exakt 6 Stellen hat – trifft
  serienmäßig auf jeden 10-stelligen Recovery-Code-Versuch zu, weil
  `loginWithTwoFactor()` denselben Eingabepfad für TOTP- und
  Recovery-Codes nutzt. `TwoFactorService.verifyCode()` fängt das jetzt
  ab und gibt `false` zurück – ohne den Try/Catch wäre jeder
  Recovery-Code-Login ein ungefangener 500er gewesen (per E2E-Test mit
  echtem otplib-generierten Code gefunden, nicht durch Code-Lesen).
- **`prisma migrate dev` vs. `db push`:** dieses Repo pflegt zwar einen
  `migrations`-Ordner, die tatsächliche Dev-Datenbank ist aber seit dem
  Mehrfach-Rollen-Umbau (siehe [rbac-rework.md](./rbac-rework.md)) per
  `db push` weitergepflegt und dadurch von der Migrationshistorie
  abgekoppelt. `pnpm db:migrate` (= `prisma migrate dev`) wollte deshalb
  das komplette `public`-Schema zurücksetzen ("All data will be lost") –
  abgebrochen, stattdessen direkt `npx prisma db push` in
  `packages/database` verwendet (keine Datenverluste).
- **`prisma generate` schlägt mit `EPERM` fehl, solange ein laufender
  `nest start --watch`-Prozess die Query-Engine-DLL offen hält** (Windows
  sperrt die Datei für den Rename-Schritt) – Dev-Server vor jedem
  Schema-Update stoppen, danach neu starten.
- **Verwaiste Prozesse nach vorherigem fehlgeschlagenem `turbo run
  dev`-Versuch:** Ein Root-`pnpm dev`, das Windows/turbo nach einem
  gescheiterten Lauf in einer früheren Session nicht sauber beendet hatte,
  hielt zusätzlich zum eigentlichen API-Prozess eine zweite
  `nest start --watch`-Instanz sowie einen kompilierten `dist/main`-Prozess
  am Leben – alle drei mussten identifiziert (`Get-CimInstance
  Win32_Process -Filter "Name='node.exe'"` inkl. `CommandLine`) und
  gezielt beendet werden, bevor `prisma generate` durchlief.

## Relevante Dateien

- `packages/database/prisma/schema.prisma` (`User.twoFactor*`,
  `AppSettings.allowTwoFactor`/`requireTwoFactorForAdmins`)
- `apps/api/src/common/utils/totp-encryption.ts`,
  `src/common/config/env.validation.ts`
- `apps/api/src/auth/two-factor/two-factor.service.ts`
- `apps/api/src/auth/auth.service.ts` (`login`, `loginWithTwoFactor`,
  `setupTwoFactor`, `verifyTwoFactorSetup`, `disableTwoFactor`,
  `issueTokens`)
- `apps/api/src/auth/guards/two-factor-setup.guard.ts`,
  `src/auth/decorators/allow-two-factor-setup-required.decorator.ts`
- `apps/api/src/auth/strategies/jwt.strategy.ts`
  (`TwoFactorChallengePayload`)
- `apps/api/src/users/users.service.ts` (`disableTwoFactor`),
  `src/users/users.controller.ts` (`POST /users/:id/disable-2fa`)
- `apps/api/src/settings/*` (`allowTwoFactor`/`requireTwoFactorForAdmins`
  in DTO, Service, `getPublic()`)
- `apps/web/src/components/two-factor-setup-card.tsx`,
  `my-account-view.tsx`, `login-form.tsx`, `account-lock-banner.tsx`
- `apps/web/src/app/api/auth/2fa/*/route.ts`,
  `src/app/api/auth/me/{avatar,stats,sessions}/route.ts`,
  `src/app/api/auth/login/route.ts` (mfaRequired-Zweig),
  `src/app/api/users/[id]/disable-2fa/route.ts`
- `apps/web/src/middleware.ts` (Redirect bei `mustChangePassword`/
  `twoFactorSetupRequired`), `src/app/dashboard/layout.tsx`

## Update 2026-08-17: Recovery-Codes neu generieren, Einrichtungsdatum, Avatar/Sitzungen im "Mein Konto"-Umbau

Im Zuge der "Mein Konto"-Neugestaltung (siehe
[self-service-auth-flows.md](./self-service-auth-flows.md)) ergänzt:

- **`User.twoFactorEnabledAt`** (`DateTime?`): nur zur Anzeige
  ("Authenticator-App eingerichtet am ..."), gesetzt in
  `verifyTwoFactorSetup()`, zurückgesetzt auf `null` bei jeder Art von
  Deaktivierung (Self-Service **und** Admin-Zwangsdeaktivierung) – bewusst
  kein erfundener Wert wie z.B. `updatedAt`, das bei jeder beliebigen
  Feldänderung mitläuft und damit nicht spezifisch genug wäre.
- **`POST /auth/2fa/regenerate-recovery-codes`** (`AuthService.
  regenerateRecoveryCodes()`): löst den unten stehenden "Offenen Punkt".
  Verlangt `twoFactorEnabled: true`, ersetzt die gehashten Codes komplett,
  gibt die neuen einmalig im Klartext zurück – gleiches Prinzip wie
  `verifyTwoFactorSetup()`. Bewusst **ohne** Passwort-Bestätigung (anders
  als `disableTwoFactor()`): der Nutzer ist bereits voll authentifiziert,
  Regenerieren ist weniger sicherheitskritisch als Deaktivieren.
- Auch die zwei bereits vorhandenen "2FA komplett aus"-Stellen
  (`disableTwoFactor()` in `auth.service.ts` und `users.service.ts`)
  setzen `twoFactorEnabledAt: null` mit.

## Update 2026-08-17 (2): 2FA-Status durchgängig als Badge statt Tooltip-Icon

Auf Nutzervorgabe ("nutze immer den Text und das Icon in einem Badge. Rot,
wenn nicht im Einsatz, und grün wie bisher") wurden alle verbleibenden
bloßen Icon+Tooltip-Darstellungen des 2FA-Status (`ShieldCheck`/`ShieldOff`
ohne sichtbaren Text, nur bei Hover erklärt) durch echte `Badge`s mit Icon
**und** Text ersetzt – betrifft `UserEditView`s Kopf-Karte, `users-table.tsx`s
2FA-Spalte und `MyAccountView`s Kopf-Karte (Letztere zeigte den Badge vorher
nur im aktivierten Zustand, jetzt immer). Zwei-Farben-Schema: grün
(`bg-emerald-100 text-emerald-700 …`) wenn aktiv, sonst rot (`bg-red-100
text-red-700 …`) – auch für "systemweit deaktiviert" (`!allowTwoFactor`),
kein dritter Graustufen-Zustand mehr.

**Gleichzeitig mit angepasst** (gleiche Nutzervorgabe, "gesperrt in rotem
Badge"): der bestehende Account-Status-Badge ("Gesperrt"/"Deaktiviert")
nutzte bisher `bg-slate-200` (neutral-grau) statt Rot – in `UserEditView`
und `users-table.tsx` auf dasselbe Rot wie oben umgestellt, für ein
einheitliches Grün/Rot-Schema über alle Status-Badges hinweg (Content-
Status-Badges wie "Entwurf"/"Archiviert" in `content-table.tsx` sind davon
bewusst **nicht** betroffen – dort ist Grau ein neutraler Workflow-Zustand,
kein "schlechter" Zustand wie bei Benutzer-Sperre/2FA-Inaktivität).

## Offene Punkte

- `requireTwoFactorForAdmins` gilt nur für die Rolle "Administrator"
  (namensbasiert wie der bestehende `assertMayAssignRole()`-Check in
  `UsersService`), keine Erzwingung pro beliebiger Rolle.
- E2E-Testsuite (`apps/api/test/*.e2e-spec.ts`) deckt 2FA noch nicht ab –
  bisher nur manuell per `curl` (kompletter Flow inkl. Recovery-Code,
  Admin-Disable, globaler Schalter) und Playwright-Browsertest verifiziert.
